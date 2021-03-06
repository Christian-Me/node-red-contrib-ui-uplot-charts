
export default function configUiElements (node,root,id) {
    this.root = root;
    this.id = id;
    this.uiElements = {};
    this._groupId = '';
    this._groups = [];
    this._groupCounter = 0;
    this._container= null;
    this._parentContainer = null;
    this._lastId = '';
    this.setRow = function(row) {
        this._groupId = '';
        this._container=row;
        // this._container.css('display','inline-block');
        return this;
    }
    const labelWidth = "20%";
    const contentWidth = 78; // in %
    /**
     * Set the value for the given object for the given path
     * where the path can be a nested key represented with dot notation
     * https://codereview.stackexchange.com/questions/194338/safely-setting-object- properties-with-dot-notation-strings-in-javascript
     *
     * @param {object} obj   The object on which to set the given value
     * @param {string} path  The dot notation path to the nested property where the value should be set
     * @param {mixed}  value The value that should be set
     * @return {mixed}
     *
     */
     this.setProperty = function (obj, path, value) {
        // protect against being something unexpected
        obj = typeof obj === 'object' ? obj : {};
        // split the path into and array if its not one already
        var keys = Array.isArray(path) ? path : path.split('.');
        // keep up with our current place in the object
        // starting at the root object and drilling down
        var curStep = obj;
        // loop over the path parts one at a time
        // but, dont iterate the last part,
        for (var i = 0; i < keys.length - 1; i++) {
            // get the current path part
            var key = keys[i];

            // if nothing exists for this key, make it an empty object or array
            if (!curStep[key] && !Object.prototype.hasOwnProperty.call(curStep, key)){
                // get the next key in the path, if its numeric, make this property an empty array
                // otherwise, make it an empty object
                var nextKey = keys[i+1];
                var useArray = /^\+?(0|[1-9]\d*)$/.test(nextKey);
                curStep[key] = useArray ? [] : {};
            }
            // update curStep to point to the new level
            curStep = curStep[key];
        }
        // set the final key to our value
        var finalStep = keys[keys.length - 1];
        // if (!Array.isArray(curStep) || typeof curStep !== 'object')  curStep = {};
        curStep[finalStep] = value;
        return value;
    };

    this.setGroup = function(groupId,show=true,cssClass='') {
        this._groupId = groupId;
        if (!this._groups.find(element => id === groupId)) { this._groups.push({
                id:groupId,
                parent:this._container
            })
        };
        this._parentContainer = this._container;
        let classClassString = '';
        let marginLeft = (this._groupCounter+1)*5;
        if (typeof cssClass === 'string') {
            classClassString = (cssClass) ? `class="${cssClass}" ` : '';
        } else {
            classClassString = `class="${cssClass.id}" `;
            if (cssClass.label) {
                if (cssClass.collapsible) {
                    var button = $(`<div class="red-ui-editor" style="cursor:pointer; margin: 5px 0px 5px ${marginLeft}px;"><i class="fa fa-plus-square"></i><span style="margin-left:10px; ${(cssClass.textStyle) ? cssClass.textStyle : ''}">${node._(this.root+"."+this.id+".label." + ((this._groupId!=='') ? this._groupId+'.' : '') + cssClass.label)}</span></div>`).appendTo(this._container);
                    button.click(element => {
                        const icons = ["fa fa-plus-square", "fa fa-minus-square"];
                        // console.log(($(element.currentTarget.nextElementSibling).css('display') !== 'none') ? 0 : 1);
                        $(element.currentTarget.firstChild).removeClass(icons[($(element.currentTarget.nextElementSibling).css('display') === 'none') ? 0 : 1]);
                        $(element.currentTarget.firstChild).addClass(icons[($(element.currentTarget.nextElementSibling).css('display') !== 'none') ? 0 : 1]);
                        $(element.currentTarget.nextElementSibling).slideToggle(200);
                    });
                }
            }
            if (cssClass.collapsed) {
                show = false;
            }
        }
        this._container = $(`<div ${classClassString}id="node-group-${this.id}-${groupId}" style="${(show)? '' : 'display:none;'}">`).appendTo(this._container);
        this._groupCounter++;
    }
    this.closeGroup = function() {
        this._container=this._parentContainer;
        this._parentContainer = null;
        this._groupCounter--;
    }
    this.setGroupVisibility = function(element, parentId = '', groupId = '') {
        let children = element.parent().find(`#node-group-${this.id}-${parentId}`).children();
        children.fadeOut(200);
        children.parent().find(`#node-group-${this.id}-${groupId}`).fadeIn(200);
    }
    this.addEvent = function(onEvent = "click", event = null, id, execute) {
        if (id === undefined) id = this._lastId;
        this.uiElements[id].element.on(onEvent,( function() { 
            event($(this));
        }))
        if (execute) {
            event(this.uiElements[id].element);
        }
    }
    this.getElements = function() {
        return this.uiElements;
    }
    this.getElement = function(container,id) {
        return container.find(`.node-input-${this.id}-${id.replaceAll('.','-')}`);
        return $(`.node-input-${this.id}-${id.replaceAll('.','-')}`);
    }
    this.addClassicLabel = function(label, icon = '') {
        let forId = `node-input-${(this.id!=='') ? this.id+'-' : ''}${label}`;
        label = node._(this.root+"."+this.id+".label." + ((this._groupId!=='') ? this._groupId+'.' : '') + label);
        icon = icon ? `<i class="${icon}"></i>&nbsp;` : '';
        $(`<label for="${forId}">${icon}<span>${label}</span></label>`)
            .appendTo(this._container);
    }
    this.addLabel = function(label,width = labelWidth) {
        $(`<div style="text-align: end;"><span>${node._(this.root+"."+this.id+".label." + ((this._groupId!=='') ? this._groupId+'.' : '') + label)}${(label!=='&nbsp;') ? ':&nbsp;' : ''}</span></div>`).css('display','inline-block').css('width',width).appendTo(this._container);
    }
    this.addText = function(label,width = labelWidth) {
        $(`<div><span>${node._(this.root+"."+this.id+".label." + ((this._groupId!=='') ? this._groupId+'.' : '') + label)}</span></div>`).css('display','inline-block').css('width',width).appendTo(this._container);
    }
    this.addInput = function(id,type,value, width = contentWidth, configId = '', visible = true) {
        if (type === 'color' ) { // use typed input color pickers
            return this.addTypedInput(id,[
                {value:"colorRGBA",label:"Colour RGBA", icon:"fa fa-eyedropper", customValue: value, linkValue: ['colorPalette']},
                {value:"colorPalette",label:"Color Palette",icon:"fa fa-tint", customValue: value, linkValue: ['colorRGBA']}],
                value, "colorRGBA",width
            );
        }
        let def = {
            class: `node-input-${this.id}-${id.replaceAll('.','-')}`,
            style: `width:${width}; ${(type?.type==="checkbox") ? "vertical-align: unset; " : ""}${(!visible) ? "display:none; " : ""}`,
            id: (configId ? `node-input-${configId}` : undefined),
            placeholder: node._(this.root+"."+this.id+".placeholder." + ((this._groupId!=='') ? this._groupId+'.' : '') + id)
        }
        this._lastId = id;
        switch (typeof type) {
            case 'string' :
                def.type = type;
                break;
            case 'object':
                Object.keys(type).forEach(key => {
                    def[key] = type[key];
                })
        }
        if (this.uiElements[id]===undefined) this.uiElements[id]={id,def:def};
        this.uiElements[id].element = $('<input/>', def).appendTo(this._container);
        if (value !==undefined) this.uiElements[id].element.val(value);
        return this.uiElements[id].element;
    }

    this.addTypedInput = function(id,types,value,type,width = contentWidth, change = null, opts = undefined) {
        this.uiElements[id]={id,def:{
            class: `node-input-${this.id}-${id.replaceAll('.','-')}`,
            style: `width:${width};`,
            type: 'text',
            types: types
        }}
        var labelRoot = `${this.root}.${this.id}.label.${((this._groupId!=='') ? this._groupId+'.' : '')}`;
        this.uiElements[id].typedInput=true;
        switch (type) {
            case 'selected': // convert to comma separated string if necessary
                value = (Array.isArray(value)) ? value.toString() : value;
                break;
        }

        // prepare "custom" types if necessary
        types.forEach(type => {
            switch (type.value) {
                case 'multiValue':
                    console.log({id,types,value,type})
                    type.valueLabel = function(container,value) {
                        var that = this;
                        if (container.children().length===0)  { // empty container
                            let typeElement = that[that.propertyType] = {};
                            let customValue = that.bindings.prop('_typedInputData')?.[that.propertyType]?.value || value;
                            that.updateMultiValue = function(element,value) {
                                let typeObject = that.bindings.prop('_typedInputData');
                                if (typeObject) {
                                    let typeData = typeObject[that.propertyType];
                                    if (!typeData.value) typeData.value = {};
                                    typeData.value[element] = Number(value);
                                }
                                //console.log('updateMultiValue',typeObject,value);
                            };
                            typeElement.inputs=[];
                            type.inputs.forEach((input,index) =>{

                                
                                input.props.style=`width:100%; height:${container.height()}; padding: 7px 14px 0px 5px; margin-right:0px; margin-left:0px; direction:rtl; text-indent:5px;`;
                                container.css('display','flex');
                                let inputContainer=$(`<div class="red-ui-typedInput-input-wrap" style="width:${(100/type.inputs.length)}%;">`).appendTo(container);
                                typeElement.inputs[index] = $('<input/>', input.props).appendTo(inputContainer);
                                let typeValue = that.bindings.prop('_typedInputData')?.[that.propertyType]?.value?.[input.property];
                                typeElement.inputs[index].val(typeValue || input.value);
                                that.updateMultiValue(input.property, typeValue || input.value);

                                typeElement.inputs[index].on('input', event => {
                                    var thisInput = input;
                                    that.updateMultiValue(thisInput.property,event.target.value);
                                });
                                // add value label and unit
                                $('<div class="inputLabels"></div>').text(node._(labelRoot+input.property+".label")).css({top:"-34px", left: "9px"}).appendTo(inputContainer);
                                $('<div class="inputLabels"></div>').text(node._(labelRoot+input.property+".unit")).css({top:"-32px", right: "5px", "text-align": "end"}).appendTo(inputContainer);
                            })
                        }
                    }
                    break;
                case 'colorRGB':
                    type.valueLabel = function(container,value) {
                        var that = this;
                        if (container.children().length===0)  {
                            let typeElement = that[that.propertyType] = {};
                            let customValue = String(that.bindings.prop('_typedInputData')?.[that.propertyType]?.value || value).substr(0,7);
                            
                            typeElement.picker = $(`<input type="color" class="colorButton nr-db-field-themeColor" style="position: unset; background-color: ${customValue};" value="${customValue}"</input>`).appendTo(container);
                            typeElement.input = $(`<input type="text" style="padding: 0px; border: 0px;" value="${customValue}"</input>`).appendTo(container);

                            that.updateButtonRGB = function(element,value) {
                                if (that.typeMap[that.propertyType].validate(value)) {
                                    let typeObject = that.bindings.prop('_typedInputData');
                                    let typeData = typeObject?.[that.propertyType] || {value};
                                    if (typeData.value!=value) {
                                        typeData.value=value;
                                        that[that.propertyType][element].val(value);
                                        if (Array.isArray(that.linkValue)) {
                                            for (let link in that.linkValue) {
                                                console.log('Link rgb to',link);
                                                typeObject[link].value= value;
                                            }
                                        }
                                        that[that.propertyType].picker.css('background-color', value);
                                    }
                                    $(that.valueLabelContainer).parent().removeClass('input-error');
                                } else {
                                    $(that.valueLabelContainer).parent().addClass('input-error');
                                }
                            }

                            typeElement.picker[0].addEventListener('input', event => {
                                that.updateButtonRGB('input',event.target.value);
                            });
                            
                            typeElement.input.on('input', event => {
                                that.updateButtonRGB('picker',event.target.value);
                            });

                            if (that.value()!=customValue) that.value(customValue);
                        }
                    }
                    type.validate = function (v) {
                        let pattern = /^(\#[\da-f]{6})/i;
                        return pattern.test(v);
                    }
                    break;
                case 'colorRGBA': // RGBA Color picker credits: https://github.com/R-TEK/colr_pickr
                    type.valueLabel = function(container,value) {
                        var that = this;
                        that.updateButtonRGBA = function(value) {
                            var that = this;
                            let typeConfig = that.typeMap[that.propertyType];
                            if (typeConfig.validate(value)) {
                                let typeObject = that.bindings.prop('_typedInputData');
                                let typeData = typeObject?.[that.propertyType] || {value};
                                if (typeData.value!=value) {
                                    typeData.value=value;
                                    if (Array.isArray(typeConfig.linkValue)) {
                                        for (let link of typeConfig.linkValue) {
                                            typeObject[link].value= value;
                                        }
                                    }
                                    that[that.propertyType].colorPickerComp.colorChange(value,that[that.propertyType].button[0]);
                                    that[that.propertyType].input.val(value);
                                }
                                $(that.valueLabelContainer).parent().removeClass('input-error');
                                that[that.propertyType].button.css('background',value);
                            } else {
                                $(that.valueLabelContainer).parent().addClass('input-error')
                            }
                        }
                        let customValue = that.bindings.prop('_typedInputData')?.[that.propertyType]?.value || value;
                        if (that.value()!=customValue) that.value(customValue);
                        let buttonId = `${that.identifier}-${that.propertyType}`;
                        console.log('colorRGBA label',container.children().length)
                        if (container.children().length===0) {
                            //container.css({"padding-top":"unset","opacity": "unset"});
                            let typeElement = that[that.propertyType] = {};
                            $(`<img class="alphaPattern"></span>`).appendTo(container);
                            typeElement.button = $(`<button class="alphaButton colorButton red-ui-button" id="${buttonId}"></button>`).appendTo(container);
                            typeElement.input = $(`<input type="text" style="padding: 0px; border: 0px;" value="${customValue}"</input>`).appendTo(container);
                            typeElement.picker = new ColorPicker(typeElement.button[0],customValue);
                            typeElement.colorPickerComp = colorPickerComp;
                            that.updateButtonRGBA(customValue);

                            typeElement.button[0].addEventListener('colorChange', event => {
                                var typeInput = that;
                                typeInput.updateButtonRGBA(event.detail.color.hexa);
                            });
                            
                            typeElement.input.on('input', event => {
                                var typeInput = that;
                                typeInput.updateButtonRGBA(event.target.value);
                            })
                        }
                    }
                    type.validate = function (v) {
                        let pattern = /^(\#[\da-f]{3}|\#[\da-f]{6}|\#[\da-f]{8}|rgba\(((\d{1,2}|1\d\d|2([0-4]\d|5[0-5]))\s*,\s*){2}((\d{1,2}|1\d\d|2([0-4]\d|5[0-5]))\s*)(,\s*(0\.\d+|1))\)|hsla\(\s*((\d{1,2}|[1-2]\d{2}|3([0-5]\d|60)))\s*,\s*((\d{1,2}|100)\s*%)\s*,\s*((\d{1,2}|100)\s*%)(,\s*(0\.\d+|1))\)|rgb\(((\d{1,2}|1\d\d|2([0-4]\d|5[0-5]))\s*,\s*){2}((\d{1,2}|1\d\d|2([0-4]\d|5[0-5]))\s*)|hsl\(\s*((\d{1,2}|[1-2]\d{2}|3([0-5]\d|60)))\s*,\s*((\d{1,2}|100)\s*%)\s*,\s*((\d{1,2}|100)\s*%)\))$/i;
                        return pattern.test(v);
                    }
                    break;
                case 'colorPalette':
                    type.valueLabel = function(container,value) {
                        var that = this;
                        console.log('colorPalette',container,value);
                        if (container.children().length===0)  {
                            let typeElement = that[that.propertyType] = {};
                            let customValue = that.bindings.prop('_typedInputData')?.[that.propertyType]?.value || value;
                            typeElement.picker = RED.editor.colorPicker.create({
                                id:`${that.identifier}-${that.propertyType}`,
                                value: customValue,
                                palette: ['#1F77B4', '#AEC7E8', '#FF7F0E', '#2CA02C', '#98DF8A', '#D62728', '#FF9896', '#9467BD', '#C5B0D5'], //that.bindings.prop('_typedInputData')?.[that.propertyType]?.palette || [],
                                cellPerRow: 9,
                                cellWidth: 16,
                                cellHeight: 16,
                                cellMargin: 3,
                                opacity: parseInt(customValue.substring(7),16)/255 || 1
                            }).appendTo(container);
                            console.log(`${that.identifier}-${that.propertyType}`,typeElement.picker);
                            typeElement.input = $(`<input type="text" style="padding: 0px; border: 0px;" value="${customValue}"</input>`).appendTo(container);

                            that.updateElements = function(element,value) {
                                let typeConfig = that.typeMap[that.propertyType];
                                if (typeConfig.validate(value)) {
                                    let typeObject = that.bindings.prop('_typedInputData');
                                    let typeData = typeObject?.[that.propertyType] || {value};
                                    if (typeData.value!=value) {
                                        that[that.propertyType][element].val(value);
                                        typeData.value=value;
                                        if (Array.isArray(typeConfig.linkValue)) {
                                            for (let link of typeConfig.linkValue) {
                                                typeObject[link].value= value;
                                            }
                                        }
                                    }
                                    $(that.valueLabelContainer).parent().removeClass('input-error');
                                    that[that.propertyType].picker.css('background-color', value);
                                } else {
                                    $(that.valueLabelContainer).parent().addClass('input-error');
                                }
                            }

                            $(`#${that.identifier}-${that.propertyType}`).on('change', event => {
                                var that=this;
                                that.updateElements('input',event.target.value);
                            });
                            
                            $(`#${that.identifier}-${that.propertyType}-opacity`).on('change', event => {
                                var that=this;
                                console.log(event.target.value);
                                that.updateElements('input',event.target.value);
                            });
                            
                            typeElement.input.on('input', event => {
                                that.updateElements('picker',event.target.value);
                            });

                            if (that.value()!=customValue) that.value(customValue);
                        }
                    }
                    type.validate = function (v) {
                        let pattern = /^(\#[\da-f]{6}|\#[\da-f]{8})/i;
                        return pattern.test(v);
                    }
                    break;
                case 'function':
                    type.valueLabel = function(container,value) {
                        var that = this;
                        var element = that.bindings;
                        let typeObject = element.prop('_typedInputData');
                        let typeData = typeObject?.function?.value || value;
                        console.log('valueLabel',value,typeData);
                        // container.css({"padding-top":"8px","opacity": "0.6"});
                        var nodeLabel = $(`<span style="display: inline-block; padding-top: 8px; opacity: 0.6;">${typeData}</span>`).appendTo(container);
                    }
                    type.expand = function () {
                        var that = this;
                        var element = that.bindings;
                        RED.editor.editJavaScript({
                            mode: 'ace/mode/nrjavascript',
                            value: element.prop('_typedInputData').function.value,
                            width: "Infinity",
                            cursor: element.prop('_typedInputData').function.cursor,
                            complete: function(v,cursor) {
                                let _typedInputData = element.prop('_typedInputData')
                                _typedInputData.function.value=v;
                                _typedInputData.function.cursor=cursor;
                                that.value(v);
                                element.prop('_typedInputData',_typedInputData);
                            }
                        });
                    }
                    break;
            }
        });

        var element = this.uiElements[id].element = $('<input/>', this.uiElements[id].def)
            .appendTo(this._container)
            .typedInput({types: types})
            .typedInput('width',width)
            .typedInput('type',type)
            .typedInput('value',value);

        if (types.length<2) { // hide unused elements for single type inputs (if demanded)
            if (opts?.hideTypeSelect) {
                element.next().find('.red-ui-typedInput-type-select').css('display','none');
            }
            if (opts?.hideBorder) {
                element.next().css('border','unset');
            }
        }

        // add special values if necessary
        let _typedInputData = element.prop('_typedInputData') || {};
        types.forEach(type => {
            switch (type.value) {
                case 'selected':
                    _typedInputData[type.value]={value};
                    break;
                case 'function':
                    _typedInputData[type.value]={"value":type.customValue || value,cursor:{}};
                    break;
                case 'multiValue':
                    _typedInputData[type.value]={value:{}};
                    type.inputs.forEach((input,index) =>{
                        _typedInputData[type.value].value[input.property]=input.value || value;
                    });
                    break;
                default:
                    _typedInputData[type.value]={"value":type.customValue || value};
                    break;                                    
            }
        });
        element.prop('_typedInputData',_typedInputData);

        if (typeof change === "function") {
            element.on('change',change);
        }/* else {
            element.on('change',(event, type, value) => {
                var thisElement = element;
                console.log({type,value,"this":this,thisElement});
                return;
                if (that.lastType!==type) {
                    console.log({type,value,"this":this,thisElement});
                }
                that.lastType = type;
            })
        }*/
    }
    this.addSelect = function(id,choices,value, width = contentWidth, valueType = "string", props = {}) {
        let def = {
            class: `node-input-${this.id}-${id.replaceAll('.','-')}`,
            style: `width:${width};`,
            type: 'select',
            valueType
        }
        Object.keys(props).forEach(key => def[key] = props[key]);
        this._lastId = id;
        if (this.uiElements[id]===undefined) this.uiElements[id]={id,def:def};
        let element = $('<select/>', def).appendTo(this._container);
        choices.forEach( (item,index) => {
            switch (typeof item) { 
                case 'string': 
                    element.append($('<option></option>').val(item).text(item)); 
                    break;
                case 'object': 
                    if (item.hasOwnProperty('i18n')) {
                        element.append($('<option></option>')
                            .val((item.value!==undefined) ? item.value : node._(this.root+'.'+this.id+'.select.'+item.i18n+'.'+index))
                            .text(node._(this.root+'.'+this.id+'.select.'+item.i18n+'.'+index))); 
                        break;
                    }
                    if (item.hasOwnProperty('text')) {
                        element.append($('<option></option>').val(item.value).text(item.text)); 
                        break;
                    }
                    break;
            }
        })
        if (value !==undefined) {
            element.val(value);
        } else if (choices[0] !== undefined) {
            if (typeof choices[0] === 'string') {
                element.val(choices[0]);
            } else {
                element.val(choices[0].value);
            }
        }
        this.uiElements[id].element = element;
        return element;
    };
    this.addEditor = function (id, mode, value, params) {
//                    $(`<div id="node-input-${this.id}-${id.replaceAll('.','-')}" style="display:none">`).appendTo(this._container);
        this.uiElements[id] = {
            id,
            type: 'editor',
            mode,
            button: $(`<a id="node-button-${this.id}-${id}" class="red-ui-button" style="width:30px;"><i class = "fa fa-pencil"></i></a>`),
            def:{
                class: `node-input-${this.id}-${id.replaceAll('.','-')}`,
                style: `width:20px;`,
                type: 'editor'
            }
        };
        var editButton = this.uiElements[id].button.appendTo(this._container);
        editButton.addClass(`node-input-${this.id}-${id.replaceAll('.','-')}`);
        editButton.prop('_editorValue',value);
        editButton.prop('_cursor',{});
        editButton.on("click", function(e) {
            e.preventDefault();
            console.log('editor',editButton,editButton.prop('_editorValue'));
            RED.editor.editJavaScript({
                mode: 'ace/mode/nrjavascript',
                value: editButton.prop('_editorValue'),
                width: "Infinity",
                cursor: editButton.prop('_editorCursor'),
                complete: function(v,cursor) {
                    editButton.prop('_editorValue',v);
                    editButton.prop('_editorCursor',cursor);
                }
            })
        });
        if (params.hasOwnProperty('buttonEnabled') && !params.buttonEnabled) {
            editButton.css({"pointer-events":"none",cursor:"not-allowed",opacity:'0.5'});
        }
    };
    this.addElement = function(type,option='') {
        switch (type) {
            case 'br': $('<br>').appendTo(this._container); break;
            case 'hr': $(`<hr${option}>`).appendTo(this._container); break;
            case 'i': $(`<i class="${option}"></i>`).appendTo(this._container); break;
        }  
    };
    this.addButton = function(id,label, width = contentWidth, onEvent = "click", event = null) {
        let button = $(`<a id="node-button-${this.id}-${id}" class="red-ui-button">${node._(this.root+"."+this.id+".label."+label)}</a>`).css('width',width);
        if (event!== null) {
            button.on(onEvent,( () => { 
                event(button);
            }))
        }
        button.appendTo(this._container);
    }
    this.setInput = function(id,value) {
        let input = $(`.node-input-${this.id}-${id.replaceAll('.','-')}`);
        if (input.length>0) { // input or typed input
            if (input[0].className.search('typedInput') > 0) {
                input.typedInput('value',value);
            } else {
                input.val(value);    
            }
        } else { // button (via id)
            input = $(`#node-button-${this.id}-${id.replaceAll('.','-')}`);
            input[0].innerHTML = value;
        }
    }
    this.addProp = function (id,prop,value) {
        $(`.node-input-${this.id}-${id.replaceAll('.','-')}`).prop(prop,value);
    };
    this.setProp = function (id,prop,value) {
        this.uiElements[id]?.element?.prop(prop,value);
    };
    this.getValue = function(id,value) {
        var elements = this.uiElements;
        var result;
        Object.keys(elements).forEach( key => {
            if (key===id) {
                let type = elements[key].def.type;
                if (elements[key].typedInput) type = 'typedInput';
                switch (type) {
                    case 'select':
                        // console.log(cssKey,element.find(cssKey).val());
                        result = elements[key].element.val()
                        if (elements[key].def.valueType) {
                            switch (elements[key].def.valueType){
                                case 'integer':
                                    result = parseInt(result);
                                    break;
                            }
                        }
                        this.setProperty(value,key,result);
                        break;
                    case 'text':
                        result = this.setProperty(value,key,elements[key].element.val());
                        if (elements[key].def.hasOwnProperty('types')) {
                            switch (elements[key].element.typedInput('type')) {
                                case 'json': this.setProperty(value,key,JSON.parse(result)); break;
                                case 'num':  this.setProperty(value,key,Number(result)); break;
                                case 'bool': this.setProperty(value,key,(result=='true') ? true : false); break;
                            };
                        }
                        return;
                    case 'typedInput':
                        result = elements[key].element.typedInput('value');
                        let typedValue = elements[key].element.typedInput('value');
                        switch (elements[key].element.typedInput('type')) {
                            case 'global':
                            case 'flow':
                                result = {context : elements[key].element.typedInput('type'),typedValue}
                                result.value = typedValue.slice(typedValue.lastIndexOf(':')+1);
                                result.store = typedValue.slice(typedValue.indexOf('(')+1,typedValue.indexOf(')'));
                                break;
                            case 'json':
                                result=JSON.parse(typedValue);
                                break;
                        }
                        this.setProperty(value,key,result);
                        return;
                    case 'editor':
                        result = elements[key].editor.getValue();
                        this.setProperty(value,key,result);
                        return;
                }   
            }
        });
    };
    this.save = function (values, saveAll = true, valueFilter = []) {
        if (values===undefined) values = [];
        var components = $(`#node-input-${this.id}-container`).editableList('items');
        var node = this;
        var elements = this.uiElements;
        values.length = 0;
        components.each(function (i) {
            var element = $(this);
            var c = {};
            var result;
            Object.keys(elements).forEach( key => {
                let cssKey = `.node-input-${node.id}-${key.replaceAll('.','-')}`;
                if (element.find(cssKey).val()!==undefined) {
                    let keys = key.split('.');
                    let lastKey = keys[keys.length-1];
                    let visible = element.find(cssKey).parent().css('display') !== 'none';
                    if (visible || saveAll) {
                        switch (elements[key].def.type) {
                            case 'select':
                                // console.log(cssKey,element.find(cssKey).val());
                                result = element.find(cssKey).val()
                                if (elements[key].def.valueType) {
                                    switch (elements[key].def.valueType){
                                        case 'integer':
                                            // console.log(cssKey,result);
                                            result = parseInt(result) || 0;
                                            break;
                                    }
                                }
                                node.setProperty(c,key,result);
                                break;
                            case 'text':
                                result = node.setProperty(c,key,element.find(cssKey).val());
                                if (elements[key].def.hasOwnProperty('types')) {
                                    // console.log('text',element.find(cssKey).typedInput('type'),result);
                                    let typedInputType = element.find(cssKey).typedInput('type');
                                    let typedInputData = element.find(cssKey).prop('_typedInputData');
                                    switch (typedInputType) {
                                        case 'json': node.setProperty(c,key,JSON.parse(result)); break;
                                        case 'num':  node.setProperty(c,key,Number(result)); break;
                                        case 'bool': node.setProperty(c,key,(result=='true') ? true : false); break;
                                        case 'allSeries': node.setProperty(c,key,""); break;
                                        case 'selected': node.setProperty(c,key,(result==='')? result : result.split(',')); break;
                                        case 'multiValue':
                                            node.setProperty(c,key,{});
                                            Object.keys(typedInputData[typedInputType].value).forEach(valueKey => {
                                                // console.log('save typedInput multiValue',cssKey,c,typedInputData[typedInputType].value[valueKey],key+'.'+valueKey);
                                                node.setProperty(c,key + '.' + valueKey,element.find(cssKey).prop('_typedInputData')[typedInputType]?.value[valueKey]);
                                            })
                                            node.setProperty(c,key+'Type',typedInputType);
                                            break;
                                        default: 
                                            node.setProperty(c,key,element.find(cssKey).prop('_typedInputData')[typedInputType]?.value);
                                            node.setProperty(c,key+'Type',typedInputType);
                                            // console.log(`save typedInput [${typedInputType}] ${key}='${element.find(cssKey).prop('_typedInputData')[typedInputType]?.value}'`,cssKey,c);
                                            break;
                                    }
                                }
                                break;
                            case 'number':
                                if (!key.includes('Alpha')) { // all except Alpha as it's included in RGBA Colors
                                    node.setProperty(c,key,Number(element.find(cssKey).val()));
                                }
                                break;
                            case 'checkbox':
                                node.setProperty(c,key,element.find(cssKey).prop('checked'));
                                break;
                            case 'color':
                                let id = key.substring(0,key.search('Color')).replaceAll('.','-');
                                let property = key.substring(0,key.search('Color'));
                                node.setProperty(c,property,HEXtoRGB(
                                    element.find(`.node-input-${node.id}-${id}`+"Color")?.val(),
                                    element.find(`.node-input-${node.id}-${id}`+"Alpha")?.val()
                                ));
                                break;
                            case 'typedInput': // only arrays!
                                //console.log("typedInput",element.find(cssKey).val())
                                result = node.setProperty(c,key,JSON.parse(element.find(cssKey).val()));
                                if (!Array.isArray(result)) node.setProperty(c,key,[]);
                                break;
                            default:
                                console.warn(`UiElements.save unknown type: "${elements[key].def.type}"`);
                                break;
                        }
                    }
                }
            });
            values.push(c);
        });
    }    
};
