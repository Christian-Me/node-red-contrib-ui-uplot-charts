/**
 * Copyright 2021 Christian Meinert
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var path = require('path');
const TimeTable = require('./lib/js/timeTable.cjs.js');

module.exports = function(RED) {

    function HTML(config) {
        var configAsJson = JSON.stringify(config);
        var plugins = {};
        config.plugins.forEach(element => {plugins[element.plugin] = element.enabled;})
        var html;
        html = String.raw`
            <link rel="stylesheet" href="ui-uplot-charts/css/uPlot.min.css">
            <script type='text/javascript' src='ui-uplot-charts/js/uPlot.iife.min.js'></script>
            <script type='text/javascript' src='ui-uplot-charts/js/timeTable.umd.js'></script>
            ${(plugins.wheelPanZoomPlugin) ? "<script type='text/javascript' src='ui-uplot-charts/js/wheelZoomPlugin.umd.js'></script>" : ""}
            ${(plugins.touchZoomPlugin) ? "<script type='text/javascript' src='ui-uplot-charts/js/touchZoomPlugin.umd.js'></script>" : ""}
            ${(plugins.columnHighlightPlugin) ? "<script type='text/javascript' src='ui-uplot-charts/js/columnHighlightPlugin.umd.js'></script>" : ""}
            ${(plugins.legendAsTooltipPlugin) ? "<script type='text/javascript' src='ui-uplot-charts/js/legendAsTooltipPlugin.umd.js'></script>" : ""}
            
            <div class="uplot-charts-container" id="uplot-charts-container-${config.id}" ng-init='init(` + configAsJson + `)'>
            </div>
            `;

        return html;
    }

    function checkConfig(node, conf) {
        if (!conf || !conf.hasOwnProperty("group")) {
            _node?.error(RED._("ui_uplot-charts.error.no-group"));
            return false;
        }
        return true;
    }

    var ui = undefined;
    
    function uPlotUINode(config) {
        var _console = console;
        var node = this;

        /**
        *  adds a value to a property if value identified as a function it will 
        *   @param  {object} destination object to add or update
        *   @param  {string} param parameter to update
        *   @param  {any}    value value to be added
        *   @param  {object} scope (optional) scope to bind to function
        **/                  
        function addValueOrFunction (destination,param,value, scope = this) {
            if (typeof String.prototype.parseFunction != 'function') {
                String.prototype.parseFunction = function () {
                    var funcReg = /function *\(([^()]*)\)[ \n\t]*{(.*)}/gmi;
                    var match = funcReg.exec(this.replace(/\n/g, ' '));
                    if(match) {
                        return new Function(match[1].split(','), match[2]);
                    }
                    return null;
                };
            }
            var valueFunction;
            if (typeof value === "string" && (valueFunction = value.parseFunction())) {
                destination[param]=valueFunction.bind(scope); // to enable this.send() for callback functions.
            }
            else destination[param]= value;
        }
        /**
        *  merge one objects into another
        *   @param  {object} destination object to add or uodate
        *   @param  {object} source source object
        **/            
        function mergeObject (destination,source) {
            for (var element in source) {
                if (!destination[element]) destination[element]=(Array.isArray(source[element]))? [] : {};
                if (typeof source[element] === "object") {
                    mergeObject(destination[element],source[element])
                } else {
                    addValueOrFunction(destination,element,source[element]);
                }
            }
        }
        /**
        *  add item to an array of objects identified by a key
        *   @param  {array} target array of objects
        *   @param  {object} item object to add
        *   @param  {string} key identifier to match existing
        *   @param  {object} (optional) defaultObject if new
        *   @param  {function (item,index)} (optional) callback if default object is added to manipulate individual values
        **/
        function addOrUpdateItem(target, item, key, defaultObject = {}, update) {
            let index = target.findIndex(element => element[key] === item[key])
            if (index<0) { 
                index = target.push({})-1;
                mergeObject(target[index], defaultObject);
                if (update!==undefined) update(target[index],index);
            }
            mergeObject(target[index],item);
            return target[index];
        }
        /**
        *  converts HEX color value to rgba() css string
        *   @param  {string} hexString array of objects
        *   @param  {number} alpha (optional) alpha value (defined by alphaType)
        *   @param  {number} alphaScale (optional) range of alpha i.e. 1,100,255 defaults to 100
        **/
        function HEXtoRGB (hexString, alpha, alphaScale = 100) {
            let components = [];
            for (let i = 1; i<hexString.length; i += 2) {
                components.push(Number("0x" + hexString.substr(i,2)));
            }
            if (components.length === 3 && alpha !== undefined) {
                components.push(alpha/alphaScale);
            }
            if (components.length < 4) {
                return `rgb(${components[0]},${components[1]},${components[2]})`;
            } else {
                return `rgba(${components[0]},${components[1]},${components[2]},${components[3].toFixed(2)})`;
            }
        }
        
        var defaultColors = config.defaultColors || ['#1F77B4', '#AEC7E8', '#FF7F0E', '#2CA02C', '#98DF8A', '#D62728', '#FF9896', '#9467BD', '#C5B0D5'];
        const defaultSeries = {show:true, spanGaps:true, band: false, width: 2, dash: [], label:'unnamed',stroke:'rgba(255, 0, 0, 1)',fill:'rgba(255, 0, 0, 0)',path:'linear'}
        const defaultAxesX12h = {
            space: 40,
            incrs: [
               // minute divisors (# of secs)
               1,
               5,
               10,
               15,
               30,
               // hour divisors
               60,
               60 * 5,
               60 * 10,
               60 * 15,
               60 * 30,
               // day divisors
               3600,
               3600 * 24,
               3600 * 24 * 28,
               3600 * 24 * 365,
            // ...
            ],
            // [0]:   minimum num secs in found axis split (tick incr)
            // [1]:   default tick format
            // [2-7]: rollover tick formats
            // [8]:   mode: 0: replace [1] -> [2-7], 1: concat [1] + [2-7]
            values: [
            // tick incr          default           year                             month    day                        hour     min                sec       mode
              [3600 * 24 * 365,   "{YYYY}",         "",                            "",    "",                      "",    "",              "",        1],
              [3600 * 24 * 28,    "{MMM}",          "\n{YYYY}",                      "",    "",                      "",    "",              "",        1],
              [3600 * 24,         "{M}/{D}",        "\n{YYYY}",                      "",    "",                      "",    "",              "",        1],
              [3600,              "{h}{aa}",        "\n{M}/{D}/{YY}",                "",    "\n{M}/{D}",               "",    "",              "",        1],
              [60,                "{h}:{mm}{aa}",   "\n{M}/{D}/{YY}",                "",    "\n{M}/{D}",               "",    "",              "",        1],
              [1,                 ":{ss}",          "\n{M}/{D}/{YY} {h}:{mm}{aa}",   "",    "\n{M}/{D} {h}:{mm}{aa}",  "",    "\n{h}:{mm}{aa}",  "",        1],
              [0.001,             ":{ss}.{fff}",    "\n{M}/{D}/{YY} {h}:{mm}{aa}",   "",    "\n{M}/{D} {h}:{mm}{aa}",  "",    "\n{h}:{mm}{aa}",  "",        1],
            ],
            //  splits:
          };
        const defaultAxesX24h =  {
            space: 40,
            incrs: [
               1,
               5,
               10,
               15,
               30,
               60,
               60 * 5,
               60 * 10,
               60 * 15,
               60 * 30,
               3600,
               3600 * 24,
               3600 * 24 * 28,
               3600 * 24 * 365,

            ],
            values: [
              [3600 * 24 * 365,   "{YYYY}",         "",                            "",    "",                      "",    "",              "",        1],
              [3600 * 24 * 28,    "{MMM}",          "\n{YYYY}",                    "",    "",                      "",    "",              "",        1],
              [3600 * 24,         "{DD}.{MM}",      "\n{YYYY}",                    "",    "",                      "",    "",              "",        1],
              [3600,              "{H}",            "\n{DD}.{MM}.{YY}",            "",    "\n{DD}.{MM}",               "",    "",              "",        1],
              [60,                "{H}:{mm}",       "\n{DD}.{MM}.{YY}",            "",    "\n{DD}.{MM}",               "",    "",              "",        1],
              [1,                 "{ss}s",          "\n{DD}.{MM}.{YY} {H}:{mm}",   "",    "\n{DD}.{MM} {H}:{mm}",      "",    "\n{H}:{mm}",      "",        1],
              [0.001,             "{ss}.{fff}s",    "\n{DD}.{MM}.{YY} {H}:{mm}",   "",    "\n{DD}.{MM} {H}:{mm}",      "",    "\n{H}:{mm}",      "",        1],
            ],
        //  splits:
          };
        var limit = [];
      
        try {

            var _node = (config.debugServer) ? node : undefined;
            if(ui === undefined) {
                ui = RED.require("node-red-dashboard")(RED);
            }
            RED.nodes.createNode(this, config);
            let result;
            if (config.dataStore===undefined) {
                config.dataStore = { context : "node" };
            }
            var contextObject = 
                (config.dataStore.context === 'global') ? this.context().global :
                (config.dataStore.context === 'flow') ? this.context().flow :
                this.context();
            
            console.log(RED.settings.contextStorage,config.dataStore.store);
            var contextId = config.dataStore.value || config.id.replace('.','');
            var contextStore = (!RED.settings.contextStorage) ?
                    undefined : 
                    (!config.dataStore.store || !Object.keys(RED.settings.contextStorage).includes(config.dataStore.store)) ?
                        RED.settings.contextStorage.default :
                        config.dataStore.store;
            var contextData = contextObject.get(contextId,contextStore);
            if (contextData === undefined) {
                _node?.log(`data storage initialized context:"${config.dataStore.context}" property:"${contextId}" store:"${contextStore}"`);
                contextData={};
                contextData._tableContent=[[]];
                contextData._tableRowMap={};
                contextObject.set(contextId,contextData,contextStore);
            }

            contextData._config = RED.util.cloneMessage(config);
            var chartTable = null;
            contextData._tableContent = [[]];
            if (contextData.hasOwnProperty('csv')) {
                // _console?.log(contextData);
                chartTable = new TimeTable(contextData._tableContent, contextData._tableRowMap);
                chartTable.setLogger((config.debugServer) ? node : undefined);
                chartTable.parseCSV(contextData.csv);
                _node?.log(`restored from CSV ${contextData.csv.length} bytes row map ${JSON.stringify(contextData._tableRowMap)}`)
                delete contextData.csv;

                // insert defaults if series are not configured
                Object.keys(contextData._tableRowMap).forEach ( topic => {
                    if (contextData._config.series.find(element => element.topic===topic) === undefined) {
                        _node?.log(`not configured "${topic}"" using defaults`);
                        addOrUpdateItem(contextData._config.series,{topic},'topic',defaultSeries,
                            (item,index) => {
                                let color = (defaultColors[index]!==undefined) ? defaultColors[index] : '#ff0000';
                                item.label = topic;
                                item.stroke = HEXtoRGB(color ,100);
                                item.fill = HEXtoRGB(color,30);
                                item.topicReadOnly = true;
                            }
                        );
                    }
                });
            } else {
                if (contextData._tableContent===undefined) contextData._tableContent=[[]];
                chartTable = new TimeTable(contextData._tableContent, contextData._tableRowMap);
                chartTable.setLogger((config.debugServer) ? node : undefined);
            }
            contextData._tableContent=chartTable.remapRows(config.series.map(row => row.topic));
            contextData._tableRowMap=chartTable.getRowMap(); // sync in row map
            
            _node?.log(`restored ${chartTable.getWidth()} columns and ${chartTable.getHeight()} rows from context:"${config.dataStore.context}" property:"${contextId}" store:"${contextStore}" module:"${RED.settings.contextStorage?.[contextStore].module}"`);
            result = chartTable.getSizes();
            _node?.log(`${result.cellsUsed} in ${result.columns} ${result.memoryString} (${result.ratioPercent}) `); 
            
            result = chartTable.applyRules(config.dataPlugins);
            _node?.log(`applyRules result:${result}`);
            contextData._tableContent = chartTable.cleanTable();
            result = chartTable.getWidth();
            _node?.log(`cleanTable result:${result} columns in table`);
            result = chartTable.setTimers(config.dataPlugins);
            _node?.log(`setTimers result:${result}`);
            // initialize by message data limitation plugins
            config.dataPlugins.forEach(plugin => {
                if (plugin.enabled && plugin.limitColumnsPeriods===0) {
                    limit.push({
                        plugin : plugin.plugin,
                        columns : plugin.columns,
                        every : plugin.limitColumnsEvery,
                        counter : 0,
                        rule : plugin,
                    })
                }
            })

            result = chartTable.getSizes();
            _node?.log(`${result.cellsUsed} used in ${result.columns} total cells. Memory ${result.memoryString} (usage ${result.ratioPercent}) `);            
            
            RED.httpAdmin.get("/uPlot/"+node.id, RED.auth.needsPermission('uplot.read'), function(req,res) {
                _node?.log(`http request "${req.query.query}" fom ip: ${req.headers.host}`);
                var returnItems = []; // list of Items to send back to the frontend
                var config = req.query;
                switch (config.query) {
                    case 'series':
                        if (chartTable.getHeight()>0) {
                            returnItems = contextData._config.series;
                            _console?.log('http request return:', Object.keys(returnItems).map(item => returnItems[item].label));
                        }
                        break;
                    case 'axesX':
                        switch (config.params) {
                            case '12h': returnItems = defaultAxesX12h; break;
                            case '24h': returnItems = defaultAxesX24h; break;
                        }
                        break;
                    case 'eraseData':
                        contextData._tableContent = [[]];
                        delete contextData.csv;
                        chartTable.setTable(contextData._tableContent,contextData._tableRowMap);
                        node.receive({payload:'R'}); // initialize replay of full dataset
                        returnItems = 'ok';
                        break;
                    case 'getSizes':
                        returnItems = chartTable.getSizes();
                        break;
                    case 'clean':
                        let oldColumnCount = chartTable.getWidth();
                        if (oldColumnCount>0) {
                            contextData._tableContent = chartTable.cleanTable();
                            let newColumnCount = chartTable.getWidth();
                            returnItems = `${oldColumnCount-newColumnCount} from ${oldColumnCount} columns deleted (${((1-newColumnCount/oldColumnCount)*100).toFixed(1)}%)`;
                        } else {
                            returnItems = 'database empty. no `clean` performed';
                        }
                        break;
                    default:
                        returnItems = `Error! query "${config.query}" unknown`;
                        break;
                }
                res.json(returnItems);
            })

            if (checkConfig(node, config)) {
                // Add default values to older nodes (version 1.0.0)
                config.stateField = config.stateField || 'payload';
                config.enableField = config.enableField || 'enable';
                config.width=parseInt(config.width);
                config.height=parseInt(config.height);
                var group = RED.nodes.getNode(config.group);
                config.groupId = group.id;

                var getSiteProperties = function () {
                    var opts = {}
                    opts.sizes = { sx: 48, sy: 48, gx: 4, gy: 4, cx: 4, cy: 4, px: 4, py: 4 }
                    opts.theme = {
                        'group-borderColor': {
                            value: "#097479"
                        }
                    }
    
                    if (typeof ui.getSizes === "function") {
                        if (ui.getSizes()) {
                            opts.sizes = ui.getSizes();
                        }
                        if (ui.getTheme()) {
    
                            opts.theme = ui.getTheme();
                        }
                    }
                    return opts
                }
                config.site = getSiteProperties();

                var getUiControl = function () {
                    return {
                    }
                }
                config.ui_control = getUiControl();
    
                /**
                *  calculate horizontal dimension in pixel out of grid units
                *   @param  {number} gridX  width in number of grids 
                *   @return {number} dimension in pixel
                **/
                var getX = function(gridX) {
                    return ((gridX===0) ? 0 : parseInt(config.site.sizes.sx * gridX + config.site.sizes.cx * (gridX - 1)));
                }
                /**
                *  calculate vertical dimension in pixel out of grid units
                *   @param  {number} gridY  height in number of grids 
                *   @return {number} dimension in pixel
                **/
                var getY = function(gridY) {
                    return ((gridY===0) ? 0 : parseInt(config.site.sizes.sy * gridY + config.site.sizes.cy * (gridY - 1)));
                }
                if (config.width==0) {config.width = group.config.width};
                if (config.height==0) {config.height = group.config.width};

                config.widgetProperties = {
                    x: getX(config.width)-12,
                    y: getY(config.height)-12, // square as default
                };

                chartTable.remapRows(config.series.map(item => item.topic)); // remap rows for deleted or reordered rows

                node.on("input", function(msg) {
                    node.topi = msg.topic;
                });

                var sizes = ui.getSizes();
                var html = HTML(config);                    // *REQUIRED* !!DO NOT EDIT!!
                var done = ui.addWidget({                   // *REQUIRED* !!DO NOT EDIT!!
                    type: 'chart',
                    label: config.label,
                    tooltip: config.tooltip,
                    node: node,                             // *REQUIRED* !!DO NOT EDIT!!
                    order: config.order,                    // *REQUIRED* !!DO NOT EDIT!!
                    group: config.group,                    // *REQUIRED* !!DO NOT EDIT!!
                    width: config.width,                    // *REQUIRED* !!DO NOT EDIT!!
                    height: config.height,                  // *REQUIRED* !!DO NOT EDIT!!
                    format: html,                           // *REQUIRED* !!DO NOT EDIT!!
                    templateScope: "local",                 // *REQUIRED* !!DO NOT EDIT!!
                    emitOnlyNewValues: false,               // *REQUIRED* Edit this if you would like your node to only emit new values.
                    forwardInputMessages: false,            // *REQUIRED* Edit this if you would like your node to forward the input message to it's ouput.
                    storeFrontEndInputAsState: false,       // *REQUIRED* If the widget accepts user input - should it update the backend stored state ?
                    persistantFrontEndValue: true,

                    convertBack: function (value) {
                        // _console?.log('convertBack',value);
                        return value;
                    },

                    convert: function(value,fullDataset,msg,step) {
                        let timestamp = (msg.timestamp) ? msg.timestamp/1000 : Date.now()/1000;
                        let newRowFlag = false;
                        // _console?.log('convert',msg.payload);
                        if (msg.payload==='R') {
                            if (fullDataset===undefined) {
                                fullDataset = {msg:{}};
                            }
                            _node?.log(`replay rows:${chartTable.getHeight()} columns:${chartTable.getWidth()}`)
                            fullDataset.msg.fullDataset=chartTable.getCSV();
                            fullDataset.msg.rowMap=chartTable.getRowMap();
                            fullDataset.msg.seriesConfig=contextData._config.series;
                            return fullDataset;
                        }
                        var conversion = {
                            updatedValues: {
                                msg:{}
                            },
                            newPoint: {},
                        }
                        var stateValue;
                        var stateResult = [];
                        if (fullDataset) conversion.updatedValues = fullDataset;
                        if (!msg.topic || msg.topic=='') {
                            _node?.warn('Send a unique topic with your data to identify the row. Using "unknown" for now.');
                            msg.topic = "unknown";
                        }

                        if (!chartTable.hasRow(msg.topic)) {
                            _node?.log('New row detected! ', msg.topic);
                            newRowFlag = true;

                            // update temporary config
                            addOrUpdateItem(contextData._config.series,{topic:msg.topic},'topic',defaultSeries,
                                (item,index) => {
                                    let color = (defaultColors[index]!==undefined) ? defaultColors[index] : '#ff0000';
                                    item.label = msg.label || msg.topic || "unnamed";
                                    item.stroke = HEXtoRGB(color ,100);
                                    item.fill = HEXtoRGB(color,0);
                                    item.topicReadOnly = true;
                                }
                            );
                            conversion.newPoint.newConfig={};
                            conversion.newPoint.newConfig.series = contextData._config.series;
                        }
                        
                        try {
                            stateValue = RED.util.getMessageProperty(msg, config.stateField || "payload");
                        } 
                        catch(err) {
                            _node?.warn('No or improper data received!')
                            return;
                        }
                        // let seriesIndex = -1;
                        switch (typeof stateValue) {
                            case 'string': 
                                stateValue = parseFloat(stateValue);
                            case 'number':
                                stateResult.push({
                                    id: (newRowFlag) ? msg.topic : undefined,
                                    timestamp:timestamp,
                                    value:stateValue,
                                    index: chartTable.getRowIndex(msg.topic)
                                })
                                // seriesIndex = contextData._config.series.findIndex(value =>  value.topic === msg.topic);
                                // if (seriesIndex>0) contextData._config.series[seriesIndex].topicReadOnly = true;
                                break;
                            case 'object': 
                                if (Array.isArray(stateValue)){
                                    stateResult = stateValue;
                                } else {
                                    stateResult.push(stateValue);
                                }
                                break;
                            default:
                                _node?.warn(`Improper data received! Type: ${typeof stateValue}! `,stateValue);
                                return;
                        }
                        conversion.newPoint.data = stateResult;
                        //conversion.newPoint.topic = msg.topic;
                        
                        let addedValues = chartTable.addValues(timestamp,stateResult);
                        let removed = 0;
                        limit.forEach(limitRule => {
                            limitRule.counter++;
                            if (limitRule.counter >= limitRule.every) {
                                removed += chartTable[limitRule.plugin](limitRule.rule); // call limit function
                                limitRule.counter=0;
                            }
                        })

                        //_console?.log(`updated table ${addedValues} added ${(removed>0) ? removed + ' removed' : ''}`);

                        conversion.updatedValues.msg.rowMap = chartTable.getRowMap();
                        delete conversion.updatedValues.msg.fullDataset;
                        // conversion.updatedValues.msg.fullDataset = chartTable.getTable();
                        conversion.updatedValues.msg.tempConfig = contextData._config;

                        let text = '';
                        text += `${chartTable.getWidth()} cols ${chartTable.getHeight()} rows`;
                        text += `${((removed > 0) ? ' | -' + removed + "cols": '')}`;
                        node.status({fill:"green", shape:'dot', text:text});
                        conversion.update = true;

                        return conversion;
                    },

                    beforeEmit: function(msg, fullDataset) {

                        if (fullDataset!==undefined && fullDataset.hasOwnProperty('msg') && fullDataset.msg.hasOwnProperty('fullDataset')) {
                            _node?.log(`emit full dataset`);
                            delete fullDataset.socketid; //ToDO: Only replay full dataset to requesting client
                            return fullDataset 
                        };

                        // _console?.log(`beforeEmit:`, msg, fullDataset);
                        var newMsg = fullDataset;
                        if (node._control && Object.keys(node._control).length > 0) { 
                            newMsg._control = node._control
                        };
                        
                        if (msg) {
                            // Copy the socket id from the original input message. 
                            if (msg.socketid) newMsg.socketid = msg.socketid;
                            
                            // _console?.log(`beforeEmit: (${msg.socketid})`, newMsg);
                        } else {
                            _console?.log('no Message',msg,fullDataset)
                        }
                        delete newMsg.topic
                        return { msg: newMsg };
                    },

                    beforeSend: function (msg, orig) {
                        //_console?.log('beforeSend:',msg,orig,config.outFormat);
                        if (orig) {
                            if (orig.msg.payload === 'R') {
                                node.receive(orig.msg);
                                return;
                            }
                            var newMsg = {};

                            // Store the switch state in the specified msg state field
                            RED.util.setMessageProperty(newMsg, config.stateField, orig.msg.state, true)
                            //orig.msg = newMsg;
                            node.status({fill:"red", shape:'dot', text:"message to send?"});
                            var topic = RED.util.evaluateNodeProperty(config.topic,config.topicType || "str",node,msg) || node.topi;
                            if (topic) { newMsg.topic = topic; }
                            return newMsg;
                        }
                    },

                    initController: function($scope, events) {
                        const defaultSeries = {show:true, spanGaps:true, width: 1, dash: [], label:'unnamed',stroke:'rgba(255, 0, 0, 1)',fill:'rgba(255, 0, 0, 0.3)'}
                        const defaultColors = ['#1F77B4', '#AEC7E8', '#FF7F0E', '#2CA02C', '#98DF8A', '#D62728', '#FF9896', '#9467BD', '#C5B0D5'];
                        const { linear, spline, stepped, bars } = uPlot.paths;
                        const _linear       = linear();
                        const _points       = ( () => null );
			            const _spline       = spline();
                        const _stepBefore   = stepped({align: -1});
			            const _stepAfter    = stepped({align:  1});
			            const _bars         = bars({size: [0.6, 100]});
                        var _console = console;

                        if (!$scope._data) { $scope._data = new TimeTable; }
                        var widgetDiv;
                        $scope.flag = true;   // not sure if this is needed?

                        /**
                        *  adds a value to a property if value identified as a function it will 
                        *   @param  {object} destination object to add or update
                        *   @param  {string} param parameter to update
                        *   @param  {any}    value value to be added
                        *   @param  {object} scope (optional) scope to bind to function
                        **/                  
                        function addValueOrFunction (destination,param,value, scope = this) {
                            if (typeof String.prototype.parseFunction != 'function') {
                                String.prototype.parseFunction = function () {
                                    var funcReg = /function *\(([^()]*)\)[ \n\t]*{(.*)}/gmi;
                                    var match = funcReg.exec(this.replace(/\n/g, ' '));
                                    if(match) {
                                        return new Function(match[1].split(','), match[2]);
                                    }
                                    return null;
                                };
                            }
                            var valueFunction;
                            if (typeof value === "string" && (valueFunction = value.parseFunction())) {
                                destination[param]=valueFunction.bind(scope); // to enable this.send() for callback functions.
                            }
                            else destination[param]= value;
                        }
                        /**
                        *  merge one objects into another
                        *   @param  {object} destination object to add or uodate
                        *   @param  {object} source source object
                        **/            
                        function mergeObject (destination,source) {
                            for (var element in source) {
                                if (!destination[element]) destination[element]=(Array.isArray(source[element]))? [] : {};
                                if (typeof source[element] === "object") {
                                    mergeObject(destination[element],source[element])
                                } else {
                                    addValueOrFunction(destination,element,source[element]);
                                }
                            }
                        }

                        var initVar = function(variable){
                            switch (typeof variable) {
                                case 'string': return "";
                                case 'number': return 0;
                                case 'boolean': return false;
                                case 'object': 
                                    if (Array.isArray(variable)) return [];
                                    return {};
                            }
                            return null;
                        }
                        /**
                         * update chart and adjust zoom and pan if appropriate
                         */
                        var updateChart = function() {
                            $scope.uPlot.batch(() => {
                                $scope.uPlot.setData($scope._data.getTable());
                                if ($scope.plugins.keepZoomLevelPlugin && $scope.plugins.keepZoomLevelPlugin.panWithData) {
                                    let delta=$scope._data.getLastTimestamp()-$scope._data.getTimestamp()
                                    if (delta>$scope.plugins.keepZoomLevelPlugin.initialPeriod || 0) {
                                        let scaleDelta = $scope._data.getLastTimestamp()-$scope._data.getLastTimestamp(1);
                                        _console?.log($scope.plugins.keepZoomLevelPlugin.initialPeriod,{scaleDelta,min:$scope.uPlot.scales.x.min,max:$scope.uPlot.scales.x.max});
                                        $scope.uPlot.setScale("x", {
                                            min: $scope.uPlot.scales.x.min + scaleDelta,
                                            max: $scope.uPlot.scales.x.max + scaleDelta,
                                        });
                                    }
                                }
                            });
                        }
                        /**
                        *  creates an instance of the uPlot.js widget
                        *   -   destroys existing instance
                        *   @return {void}
                        */
                        var createUPlot = function () {
                            _console?.log("create uPlot",$scope.opts,$scope._data.getTable());
                            if (!document.querySelector(widgetDiv)) {
                                let uplotDiv = document.createElement("div");
                                uplotDiv.setAttribute("class", 'uplot-charts-widget');
                                uplotDiv.setAttribute("style", `width:${$scope.config.widgetProperties.x}px;`); //  height:${$scope.config.widgetProperties.y}px;
                                uplotDiv.setAttribute("id", 'ui_uplot_chart-' + $scope.$eval('$id'));
                                document.getElementById(`uplot-charts-container-${$scope.config.id}`).appendChild(uplotDiv);
                            }
                            if($scope.uPlot !== undefined) { $scope.uPlot.destroy(); }

                            $scope._data.setHeight($scope.opts.series.length-1); // adjust height of table 
                            $scope.uPlot = uPlot($scope.opts,$scope._data.getTable(),document.querySelector(widgetDiv));

                            if ($scope.plugins.keepZoomLevelPlugin) {
                                let config = $scope.plugins.keepZoomLevelPlugin;
                                if (config.defaultZoom!==0) {
                                    let timeNow = new Date();
                                    let now = timeNow.getTime() / 1000;
                                    let min = now - ((config.defaultZoom>0)? (config.defaultZoom * config.defaultZoomPeriod) : 0);
                                    let max = now - ((config.defaultZoom>0)? 0 : (config.defaultZoom * config.defaultZoomPeriod));
                                    config.initialPeriod=max-min;
                                    $scope.uPlot.setScale("x", {min,max});
                                    _console?.log(`initial zoom ${min}:${max} start:${timeNow.getHours()}:${timeNow.getMinutes()}.${timeNow.getSeconds()} + ${config.defaultZoom * config.defaultZoomPeriod}s`)
                                }
                            }
                        }

                        var addPlugins = function (opt,plugins) {
                            $scope.plugins={};
                            plugins.forEach(plugin => {
                                if (plugin.enabled) {
                                    $scope.plugins[plugin.plugin]=plugin;
                                    switch (plugin.plugin) {
                                        case 'wheelPanZoomPlugin':
                                            if (!opt.plugins) opt.plugins=[];
                                            opt.plugins.push(wheelZoomPlugin({factor:plugin.factor}));
                                            break;
                                        case 'touchZoomPlugin':
                                            if (!opt.plugins) opt.plugins=[];
                                            opt.plugins.push(touchZoomPlugin());
                                            break;
                                        case 'legendAsTooltipPlugin':
                                            if (!opt.plugins) opt.plugins=[];
                                            opt.plugins.push(legendAsTooltipPlugin({style:{backgroundColor:plugin.background, color:plugin.text}}));
                                            break;
                                        case 'columnHighlightPlugin':
                                            if (!opt.plugins) opt.plugins=[];
                                            opt.plugins.push(columnHighlightPlugin({style:{backgroundColor:plugin.highlight}}));
                                            break;
                                    }
                                }
                            })
                        }

                        var buildScales = function (opt,scales) {
                            if (scales && Array.isArray(scales) && scales.length>0) {
                                opt.scales = {};
                                for (let scale of scales) {
                                    if (!opt.scales[scale.id]) opt.scales[scale.id]={};
                                    Object.keys(scale).forEach(key => {
                                        switch(key) {
                                            case 'id':
                                                // ignore this property
                                                break;
                                            case 'min':
                                                if (!scale.auto) {
                                                    if (!opt.scales[scale.id].range) opt.scales[scale.id].range=[];
                                                    opt.scales[scale.id].range[0]=scale.min;
                                                }
                                                break;
                                            case 'max':
                                                if (!scale.auto) {
                                                    if (!opt.scales[scale.id].range) opt.scales[scale.id].range=[];
                                                    opt.scales[scale.id].range[1]=scale.max;
                                                }
                                                break;
                                            default:
                                                if (!opt.scales[scale.id][key]) opt.scales[scale.id][key]= initVar(scale[key]);
                                                if (typeof scale[key] === 'object') {
                                                    mergeObject(opt.scales[scale.id][key],scale[key]);
                                                } else {
                                                    opt.scales[scale.id][key]=scale[key]; // ToDo: initialitze callback functions correctly
                                                }
                                                break;
                                        }
                                    });
                                }
                            }
                        }
                        var buildAxes = function (opt,axes,axesX = {}) {
                            if (axes && Array.isArray(axes) && axes.length>0) {
                                opt.axes = [];
                                if (!opt.axes[0]) opt.axes[0]={}
                                mergeObject(opt.axes[0],axesX);
                                axes.forEach((item,index) => {
                                    if (item.side<4) {
                                        if (!opt.axes[index+1]) opt.axes[index+1]={}
                                        mergeObject(opt.axes[index+1],item);
                                        if (opt.axes[index+1].side===0) delete opt.axes[index+1].side;
                                    } else {
                                        delete item.side;
                                        delete item.scale;
                                        mergeObject(opt.axes[0],item);
                                    }
                                })
                            }
                        }
                        var deleteDefaults = function (element) {
                            if (typeof element === 'object') {
                                Object.keys(element).forEach(key => {
                                    if (typeof element[key] === 'object') {
                                        deleteDefaults (element[key]);
                                    } else {
                                        if (element[key]==='default') {
                                            delete element[key];
                                        }
                                    }
                                })
                            }
                        }
                        var translateProperties = function (element,def) {
                            if (typeof element === 'object') {
                                Object.keys(element).forEach(key => {
                                    if (typeof element[key] === 'object') {
                                        translateProperties (element[key], def[key]);
                                    } else {
                                        if (def[key]!==undefined) {
                                            if (typeof def[key] === 'object') {
                                                element[def[key].property] = def[key].translate(element[key]);
                                                if (def[key].property !== key) delete element[key];
                                            } else if (def[key]!==key) {
                                                element[def[key]] = element[key];
                                                delete element[key];
                                            }
                                        } else {
                                            delete element[key];
                                        }
                                    }
                                })
                            }                                
                        }
                        var flattenObject = function (element) {
                            var hadChildren = false;
                            if (typeof element === 'object') {
                                Object.keys(element).forEach(key => {
                                    if (typeof element[key] === 'object') {
                                        hadChildren = true;
                                        Object.keys(element[key]).forEach (child => {
                                            element[child] = element[key][child];
                                        })
                                        delete element[key];
                                    }
                                });
                                if (hadChildren) flattenObject(element); // check if there are more children
                            }
                        }
                        var buildSeries = function (opt,series) {
                            if (series && Array.isArray(series) && series.length>0) {
                                opt.series = [];                            
                                series.forEach(element => {
                                    deleteDefaults(element);
                                    if (element.hasOwnProperty('points')) {
                                        translateProperties(element.points, {
                                            fillColor : "fill",
                                            strokeColor : "stroke",
                                            showType : { 
                                                property : "show",
                                                translate : input => {
                                                    let result;
                                                    switch (input) {
                                                        case 'show': result = true; break;
                                                        case 'hide': result = false;
                                                    }
                                                    return result;
                                                },
                                            },
                                            dimensions : {
                                                size : "size",
                                                width : "width"
                                            }
                                        })
                                        flattenObject(element.points);
                                    }
                                    let index = opt.series.push(element)-1;
                                    switch (element.path) {
                                        case 'linear': opt.series[index].paths = _linear; break;
                                        case 'points': 
                                            opt.series[index].lineInterpolation = null;
                                            opt.series[index].paths = _points; break;
                                        case 'spline': opt.series[index].paths = _spline; break;
                                        case 'stepBefore': opt.series[index].paths = _stepBefore; break;
                                        case 'stepAfter': opt.series[index].paths = _stepAfter; break;
                                        case 'bars': opt.series[index].paths = bars({size: [0.8, 100], align: 0}); break;
                                        default: 
                                            _console?.warn(`Series definition of ${element.topic} path definition ${element.path} invalid!`);
                                            delete opt.series[index].path;
                                            break;
                                    }
                                    if (typeof opt.series[index].scale !== 'string') delete opt.series[index].scale;
                                });
                                opt.series.unshift({});
                            } else {
                                opt.series=[];
                            }
                            _console?.log('build series', opt.series);
                        }

                        var buildBands = function (opt,plugins) {
                            if (plugins && Array.isArray(plugins) && plugins.length>0) {
                                plugins.forEach(plugin=>{
                                    if (plugin.plugin==='bands') {
                                        if (!opt.bands) opt.bands = []; 
                                        let from = $scope._data.getRowIndex(plugin.from);
                                        let to = $scope._data.getRowIndex(plugin.to);
                                        _console?.log(`band from: ${from}:"${plugin.from}" to ${to}:"${plugin.to}" `);
                                        if (from !== undefined && to !== undefined) {
                                            opt.bands.push({
                                                series: [from,to],
                                                fill:plugin.fill
                                            })
                                        } else {
                                            _console?.warn(`Bands definition invalid: ${plugin.from} ${(from===undefined) ? 'not found' : 'ok'} ${plugin.to} ${(to===undefined) ? 'not found' : 'ok'}`)
                                        }
                                    }
                                });
                            }
                            //_console?.log(' result',opt.bands);
                        }

                        $scope.init = function (config) {
                            if (!config.debugClient) { _console = undefined };
                            _console?.log('uPlot init',config);
                            if ($scope._data === undefined) {
                                $scope._data = new TimeTable;
                            }
                            
                            $scope._data.setLogger((config.debugClient) ? console : undefined);
                            $scope.config = config;
                            $scope.config.timePeriod = parseInt(config.removeOlderUnit) * parseInt(config.removeOlder);
                            $scope.config.maxPoints = parseInt(config.removeOlderPoints);
                            widgetDiv = '#ui_uplot_chart-' + $scope.$eval('$id');

                            let heightExtra = 0;
                            heightExtra += ($scope.config.spaceForTitle>0) ? parseInt($scope.config.spaceForTitle) : 50;
                            heightExtra += ($scope.config.spaceForLegend>0) ? parseInt($scope.config.spaceForLegend) : 50;


                            $scope.opts = {
                                title: $scope.config.title,
                                id: widgetDiv,
                                width: $scope.config.widgetProperties.x,
                                height: $scope.config.widgetProperties.y - heightExtra,
                            };

                            addPlugins($scope.opts,$scope.config.plugins)
                            buildSeries($scope.opts,$scope.config.series);
                            buildScales($scope.opts,$scope.config.scales);
                            buildAxes($scope.opts,$scope.config.axes,$scope.config.axesX);
                            buildBands($scope.opts,$scope.config.plugins);
                            $scope._data.setLimits($scope.config.dataPlugins);
 
                            createUPlot();
                            _console?.log('uPlot initialized > asking for replay');
                            $scope.send({payload:"R"});
                            $scope.waitingForReplay = true;
                            setTimeout(() => {$scope.waitingForReplay = false},5000);

                            let result = $scope._data.setTimers(config.dataPlugins, true);
                            _console?.log(`setTimers result:${result}`);
                        };

                        $scope.$watch('msg', function(msg) {
                            if (!msg) { return; } // Ignore undefined msg
                            if (!msg.hasOwnProperty('fullDataset') && $scope._data.getWidth()<1) {
                                if (!$scope.waitingForReplay) {
                                    _console?.log('uPlot first Message > asking for replay');
                                    $scope.send({payload:"R"});
                                    $scope.waitingForReplay = true;
                                    setTimeout(() => {$scope.waitingForReplay = false},5000);
                                } else {
                                    _console?.log('uPlot first Message > waiting for replay');
                                }
                                return;
                            }
                            if (msg.hasOwnProperty('config')) {
                                if (msg.config.hasOwnProperty('series')) {buildSeries($scope.opts,msg.config.series);}
                                createUPlot();
                            }
                            if (msg.hasOwnProperty('fullDataset')) {
                                $scope._data.parseCSV(msg.fullDataset);
                                $scope._data.setRowMap(msg.rowMap);
                                _console?.log('uPlot fullDataset received:',$scope._data.getTable(),$scope._data.getRowMap());
                                if (msg.hasOwnProperty('seriesConfig')) {buildSeries($scope.opts,msg.seriesConfig);}
                                buildBands($scope.opts,$scope.config.plugins);
                                createUPlot();
                                return;
                            } else {
                                // _console?.log('uPlot dataPoint received:',msg);
                                if (msg.hasOwnProperty('data')) {
                                    $scope._data.addValues(msg.timestamp,msg.data);
                                    $scope.config.series.forEach(series => {
                                        if (series.forward) {$scope._data.forwardValue(series.topic)}
                                    })
                                }
                                if (msg.hasOwnProperty('_control')) {

                                }
                                if (msg.hasOwnProperty('newConfig')) {
                                    if (msg.newConfig.hasOwnProperty('series')) {
                                        _console?.log('newConfig.series received',msg.newConfig.series);
                                        $scope.opts.series=[[]];
                                        buildSeries($scope.opts,msg.newConfig.series);
                                        // msg.newConfig.series.forEach(item => $scope.opts.series.push(item));
                                        createUPlot();
                                    }
                                }
                            }

                            updateChart();
                        });
                    }
                });
            }
        }
        catch (e) {
            _console?.warn(e);		// catch any errors that may occur and display them in the web browsers _console?
        }

        node.on("close", function() {
            if (RED.settings.contextStorage[contextStore].module !== "memory") {
                _node?.log(`saving ${chartTable.getWidth()} columns and ${chartTable.getHeight()} rows to "${contextStore}" using module "${RED.settings.contextStorage[contextStore].module}"`);
                contextData.csv = chartTable.getCSV();
                contextData._tableRowMap = chartTable.getRowMap();
                delete contextData._tableContent;
                delete contextData._config;
                // _console?.log(contextData);
            }
            contextObject.set(contextId,contextData,contextStore);
            // contextObject.flush();
            // delete chartTable;
            done();
        })

    }

    setImmediate(function() {
        RED.nodes.registerType("ui_uplot-charts", uPlotUINode);

        var uipath = 'ui';
        if (RED.settings.ui) { uipath = RED.settings.ui.path; }
        var fullPath = path.join('/', uipath, '/ui-uplot-charts/*').replace(/\\/g, '/');
        RED.httpNode.get(fullPath, function (req, res) {
            var options = {
                root: __dirname + '/lib/',
                dotfiles: 'deny'
            };
            res.sendFile(req.params[0], options)
        });
    })

}
