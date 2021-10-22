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

/**
 * Notes:
 * 
 * all known issues or tasks are marked with "ToDo:"
 * 
 */

class TimeTable {
  constructor(content = [[]], rowMap = {}) {
      this.node = console;
      this.setTable(content,rowMap);
      this.forwardFlags = [{forwarded:0, col:undefined}];
      this.schedules = [];
      this.rulesToApply = [];
  }
  /**
   * set a logger class. It must contain `log`, `warn` and `error` functions
   * @param {object} logger logger class (defaults to `console`)
   **/
  setLogger(logger) {
    if (logger === undefined) {
      this.node=undefined;
    } else {
      console.log(`setLogger ${(typeof logger.log === 'function') ? "ok" : "failed"}`);
      if (typeof logger.log === 'function') {
        this.node = logger;
      }
    }
  }
  /**
   * deep merge object / array
   * @param {object} target target object
   * @param {object} source source object
   **/
   mergeObject(target,source) {
    if (typeof source === 'object') {
        Object.keys(source).forEach(element => {
            if (typeof source[element] !== "object" || source[element]===null) {
                target[element] = source[element];
            } else {
                if (!target.hasOwnProperty(element)) {
                    target[element] = (Array.isArray(source[element])) ? [] : {};
                }
                this.mergeObject(target[element],source[element]);
            }
        });
    } else {
        target=source;
    }
  }
  /**
   * get reference to table data
   * @return {array} [rows][columns]
   **/
  getTable() { return this.content };
  /**
   * get last timestamp of the table
   * @param {number} offset number of rows from end (default = 0)
   * @return {number} timestamp
   **/
   getLastTimestamp(offset = 0) { return this.content[0][this.content[0].length-1-offset] };
   /**
   * set table data (reference)
   * row map will be deleted if not provided
   * @param {array} data [rows][columns] (reference)
   * @param {object} rowMap (reference) map to all row topic:indices
   **/
  setTable(data, rowMap) { 
    if (Array.isArray(data)) {
      this.content = data;
      if (rowMap===undefined) ; else {
        this.rowMap = rowMap;
      }
      Object.keys(this.rowMap).forEach(topic => {
        let i = this.rowMap[topic];
        if (!Array.isArray(this.content[i])) this.content[i] = [];

      });
      this.columns = this.content[0].length;
      this.rows = this.content.length;
    } else {this.node?.warn('timeTable.setTable() data must be an array!', data);}
  };
  /**
   * get row map
   * @return {object} rowMap {id:row}
   **/
  getRowMap() { return this.rowMap };
  /**
   * set row map
   * @param {object} rowMap {id:row}
   **/
  setRowMap(rowMap) {
    if (typeof rowMap === 'object') {
      // better keep the reference
      Object.keys(this.rowMap).forEach(key => delete this.rowMap[key]);
      this.mergeObject(this.rowMap,rowMap);
    } else {this.node?.warn('timeTable.rowMap() rowMap must be an object!', rowMap);}
  };
  /**
   * set limit rules to apply to incoming data. Previous limits will be deleted
   * @param {array} rules set of rules [{plugin:"limitColumns/limitTime",columns:{number},last:{number},period:{number},enabled:{boolean}}}]
   **/
  setLimits(rules) {
    this.rulesToApply = [];
    rules.forEach(rule => {
      if (rule.enabled && rule.limitColumnsPeriods===0) {
        if (rule.plugin===`limitColumns` || rule.plugin==='limitTime') {
          this.rulesToApply.push(rule);
        }
      }
    });
  }

  /**
   * remap rows: sort and filter existing rows according to an array of ids
   * @param {array} ids new array of keys to remap existing data
   * @return {object} updates rowMap {id:row}
   **/
  remapRows(ids) {
    if (Array.isArray(ids) && ids.length>0) {
      var tempTable = this.content;
      // this.mergeObject(tempTable,this.content); // clone the original table ToDO: find a better way (without cloning)
      ids.forEach((id,index) => {
        if (this.hasRow(id)) { // use existing row
          this.content[index+1] = tempTable[this.rowMap[id]];
        } else { // create new row
          this.content[index+1] = Array(this.content[0].length);
        }
        this.rowMap[id]=index+1; // update the map
      });
    }
    return this.rowMap;
  }
  /**
   * get width (columns)
   * @return {number} amount of columns
   **/
  getWidth() { return this.content[0].length };
  /**
   * get height (rows) without time row
   * @return {number} amount of rows
   **/
  getHeight() { return this.content.length-1 };
  /**
   * set height (rows) and adding not populated rows
   * @param {number} rows of rows without time row
   **/
  setHeight(rows) {
    var table = this;
    // this.node?.log('setHeight',table.content);
    let row = table.content.length;
    while (row <= rows) {
      table.content[row]=Array(table.content[0].length);
      row++;
    } 
    table.rows = table.content.length-1;
  };
  /**
   * checks if a row id exists
   * @param {string} id
   * @return {number} amount of rows
   **/
  hasRow(id) { return this.rowMap.hasOwnProperty(id); };
  /**
   * get row id by index, returns undefined if index don't match
   * @param {number} index
   * @return {string} row id
   **/
  getRowId(index) { 
    return Object.keys(this.rowMap).find(key => this.rowMap[key] === index);
  }
  /**
   * get row index by id, returns -1 if row does mot exist exists
   * @param {string} id
   * @return {number} row index or `undefined` if row dows not exists
   **/
  getRowIndex(id) { 
    if (this.rowMap.hasOwnProperty(id)) {
      return this.rowMap[id];
    }
    return undefined;
  }
  /**
   * get table data as a CSV string
   * JSON is not able of sparse arrays so a own 
   * stringify method is necessary
   * @return {string} stringified array
   **/
  getCSV() {
    var table = this;
    var result = '';
    table.content.forEach(row => {
      for (let i = 0; i < row.length; i++) { 
        if (row[i]!==undefined) {
          result += (row[i]!==null) ? row[i] : 'null';
        }
        result += ',';
      }
      result = result.slice(0,-1); // remove the last comma
      result += "\n";
    });
    result = result.slice(0,-2); // remove the newLine
    return result;
  };
  /**
   * set table data from a string
   * JSON is not able of sparse arrays so a own parse method is necessary
   * cells are parsed as float, 'null' strings results in a null value
   * @param {string} dataString CSV String ("\n" as row and "," as column separator) i.e. as produced by table.getCSV();
   * @return {array} [rows][columns]
   **/
  parseCSV(dataString) {
    this.node?.log(`parseCSV ${dataString.length} bytes`);
    this.content.length = 0;
    this.content[0] = [];
    let rowStrings = dataString.split('\n');
    if (rowStrings.length>1) {
      rowStrings.forEach((rowString,row) => {
        this.content[row] = [];
        let columnStrings = rowString.split(',');
        columnStrings.forEach((cell,column) => {
          if (cell!=='') {
            if (cell!=='null') {
              this.content[row][column] = parseFloat(cell);
            } else {
              this.content[row][column] = null;
            }
          }
        });
      });
    }
    this.columns=this.content[0].length;
    this.rows=this.content.length;
  }
  /**
   * add a row 
   * @param {string|number} id of that row or index number
   * @param {array} [defaultRow=[]] (optional) default content
   * @return {number} index of existing or created row (-1 if error)
   **/
  addRow(id, defaultRow = []) {
      var table = this;
      switch (typeof id) {
        case 'string':
          if (!table.rowMap.hasOwnProperty(id)) { // add a new row
              table.content[table.content.length] = defaultRow;
              table.content[table.content.length-1].length = table.content[0].length; // fill sparse array
              table.rowMap[id] = table.rows = table.content.length-1;
          }
          return table.rowMap[id];
        case 'number':
          if (id < table.content.length) {
            return id;
          } else {
            this.node?.log(`timeTable.addRow(id) id index exceeds number of initialized rows is: ${id} max ${table.content.length}`);
            return -1;
          }
        default :
          this.node?.log(`timeTable.addRow(id) id has to be of type number or string! is: "${typeof id}"`);
          return -1;
      }
  };
  
  /**
   * forwardValue(row) will forward the last known value to the latest column to enable constant states like set values in the chart
   * The data points between the last "real" value and the forwarded value will be deleted to eliminate repeating values
   * @param {number|string} row row index or topic
   **/
  forwardValue(row) {
    var table = this;
    if (typeof row === 'string') {
      row = table.rowMap[row];
    }
    if (row > 0 && row < table.content.length) {
      let col = table.content[0].length-1;
      let endCol = col;

      if (table.content[row][col]!==undefined) {
        table.forwardFlags[row]===undefined;
        this.node?.log('value present no need to forward values');
        return;
      }

      while (col>0 && table.content[row][col]===undefined) {
        col--;
      }

      if (col>0) {
        table.content[row][endCol] = table.content[row][col];
        this.node?.log(`forwarded from:${col} to:${endCol}`);
        if (table.forwardFlags[row]!== undefined) {
          this.node?.log(`deleted ${table.forwardFlags[row]}`);
          delete table.content[row][table.forwardFlags[row]];
        }
        table.forwardFlags[row]=endCol;
      }
      this.node?.log(`forwardValue(${row})`, table.content[row]);
    } else {
      this.node?.log(`timeTable.forwardValue(row) row=${row} is unknown`);
    }
  }
  /**
   * add a column 
   * @param {number} time timestamp to be added
   * @return {number} column index
   **/
  addColumnTimestamp(time) {
    var table = this;
    // ToDo: It is more likely that the timestamp is at the end of the array:
    // let col = table.content[0].length-1;
    // while (col>0 && time<table.content[0][col]) {col--}; 
    let col = table.content[0].findIndex(element => element >= time);
    table.rows = table.content.length-1;
    table.columns = table.content[0].length;
    if (col < 0 || col === undefined) { // add new column @ the end
        table.columns++;
        table.content.forEach(row => row.length = table.columns);
        col=table.columns;
    } else if (time !== table.content[0][col]) { // insert a column
        table.content.forEach(row => {
            table.columns++;
            row.splice(col, 0, undefined);
            delete row[col];
        });            
    } else { // existing column
      col++;
    }
    table.content[0][col-1] = time;
    table.rulesToApply.forEach(rule => {
      table[rule.plugin](rule);
    });
    return col-1;
  };
  /** 
  * add one or many values to one or many time columns
  * @param {number} time timestamp to be added
  * @param {array} values [{id,index,timestamp,value}] where index is used if present, timestamp is optional
  * @return {number} number of successfully added values
  **/
  addValues(time,values) {
    var table = this;
    var addedValues = 0;
    values.forEach(value => {
      let column = table.addColumnTimestamp((value.timestamp===undefined) ? time : value.timestamp);
      let row = table.addRow((value.index===undefined) ? value.id : value.index); // get or add row
      if (row>0) {
        table.content[row][column]=value.value;
        addedValues++;
      }
    });
    return addedValues;
  }

  /** 
   * clean the table array: 
   * 
   * - columns with no data in all rows will be removed from array
   * @param {object} [rule={}] rule config
   * @param {number} [start=0] start column index
   * @param {number} [end=length] end column index
   * @returns {array} reference to clean table
   **/
  cleanTable(rule = {},start = 0,end = 0){
    var table = this;
    var empty = true;
    var usedColumns = [];
    if (end === 0) end = table.content[0].length;
    for (let col=start; col<end; col++) { // do not use reduce as it works over the complete array
      empty = true;
      for (let row=1; row<table.content.length; row ++) {
        if (table.content[row][col]!==undefined) {empty = false; break;}
      }
      if (!empty) {
        usedColumns.push(col);
      }
    }
    this.node?.log(`cleanTable ${usedColumns.length}/${table.content[0].length} delete ${table.content[0].length-usedColumns.length} columns`);
    var newTable=[];
    for (let row=0; row<table.content.length; row ++) {
      newTable[row]=[];
    }
    usedColumns.forEach((index,col) => {
      for (let row=0; row<table.content.length; row ++) {
        if (table.content[row][index]!==undefined) {newTable[row][col]=table.content[row][index];}      }
    });
    // this.node?.log(`done: ${newTable[0].length} columns left`);
    table.content=newTable;
    return newTable;
  }
  /** 
   * calculate the **minimum** value of a specific period
   * 
   * **For efficiency delete cells "on the go" where data is reduced by result of this function**
   * @param {object} rule rule config
   * @param {array} rowContent complete (sparse) row content
   * @param {number} start start column index
   * @param {number} end end column index
   **/
  minCalc(rule,rowContent,start,end) {
    var result = 0;
    var columnsToDelete = [];
    for (let i=start; i<end; i++) { // do not use reduce as it works over the complete array
      if (rowContent[i]) {
        if (rowContent[i]>result) result = rowContent[i];
        columnsToDelete.push(i); // record column indices to delete later
      }
    }
    if (columnsToDelete.length>1) {
      columnsToDelete.forEach(column => delete rowContent[column]); // delete cells if more than one cell detected
      return result;
    } else {
      return undefined;
    }
  }
  /** 
   * calculate the **maximum** value of a specific period
   * 
   * **For efficiency delete cells "on the go" where data is reduced by result of this function**
   * @param {object} rule rule config
   * @param {array} rowContent complete (sparse) row content
   * @param {number} start start column index
   * @param {number} end end column index
   **/
  maxCalc(rule,rowContent,start,end) {
    var result = MAX_VALUE;
    var columnsToDelete = [];
    for (let i=start; i<end; i++) { // do not use reduce as it works over the complete array
      if (rowContent[i]) {
        if (rowContent[i]<result) result = rowContent[i];
        columnsToDelete.push(i); // record column indices to delete later
      }
    }
    if (columnsToDelete.length>1) {
      columnsToDelete.forEach(column => delete rowContent[column]); // delete cells if more than one cell detected
      return result;
    } else {
      return undefined;
    }
  }
  /** 
   * calculate the **average** value of a specific period
   * 
   * **For efficiency delete cells "on the go" where data is reduced by result of this function**
   * @param {object} rule rule config
   * @param {array} rowContent complete (sparse) row content
   * @param {number} start start column index
   * @param {number} end end column index
   **/
  averageCalc(rule,rowContent,start,end) {
    var amount = 0;
    var total = 0;
    var columnsToDelete = [];
    for (let i=start; i<end; i++) { // do not use reduce as it works over the complete array
      if (rowContent[i]) {
        total += rowContent[i];
        amount++;
        columnsToDelete.push(i); // record column indices to delete later
      }
    }
    if (columnsToDelete.length>1) {
      columnsToDelete.forEach(column => delete rowContent[column]); // delete cells if more than one cell detected
      this.node?.log(`averageCalc [${start}:${end}] = ${total/amount} columns deleted:${columnsToDelete.length}`);
      return total/amount;
    } else {
      return undefined;
    }
  }
  /** 
   * calculate the **sum** value of a specific period
   * 
   * **For efficiency delete cells "on the go" where data is reduced by result of this function**
   * @param {object} rule rule config
   * @param {array} rowContent complete (sparse) row content
   * @param {number} start start column index
   * @param {number} end end column index
   **/
  sumCalc(rule,rowContent,start,end) {
    var sum = 0;
    var columnsToDelete = [];
    for (let i=start; i<end; i++) { // do not use reduce as it works over the complete array
      if (rowContent[i]) {
        sum += rowContent[i];
        columnsToDelete.push(i); // record column indices to delete later
      }
    }
    if (columnsToDelete.length>1) {
      columnsToDelete.forEach(column => delete rowContent[column]); // delete cells if more than one cell detected
      return sum;
    } else {
      return undefined;
    }
  }
  /** 
   * reduce data by rule
   * @param {object} rule rule object containing **method,older,threshold,span,periods** property
   * @param {number} startThreshold (optional = 0) period start timestamp (in seconds) 
   * @return {number} next valid threshold
   **/
  reduceData(rule,startThreshold = 0) {  
    var table = this;
    if (startThreshold <= 0 ) startThreshold = table.content[0][0];
    const endThreshold = Date.now()/1000 - (rule.older * rule.threshold); 
    if (table.content[0][0]===undefined || table.content[0][0]>endThreshold) {
      if (table.content[0][0]!==undefined) {
        this.node?.log(`reduceData: No data before ${new Date(endThreshold*1000).toLocaleDateString()}`);
      }
      return -1; // no data available older than time Limit;
    }
    
    const periodSeconds = rule.span * rule.periods;
    const startColumn = table.content[0].findIndex(timestamp => timestamp >= startThreshold);
    const endColumn = table.content[0].findIndex(timestamp => timestamp > endThreshold);
    var cursor = {
      nextThreshold:startThreshold+periodSeconds,
      start:{timestamp:startThreshold,column:startColumn},
      end:{timestamp:startThreshold,column:startColumn},
      ruleEnd:{timestamp:endThreshold,column:endColumn-1},
      midPoint:0
    };
    var result = 0;
    var resultAt = 0;

    // this.node?.log(`reduceData between ${startColumn}/${new Date(startThreshold*1000).toLocaleDateString()} and ${endColumn}/${new Date(endThreshold*1000).toLocaleDateString()} rule="${rule.method}"`); // ,cursor,rule

    for (let row = 1; row < table.content.length; row ++) {
      if (rule.applyTo==='' || (Array.isArray(rule.applyTo) && rule.applyTo.includes(table.getRowId(row)))) {
        cursor.start.column=startColumn;
        cursor.start.timestamp=startThreshold;
        cursor.end.column=startColumn;
        cursor.end.timestamp=startThreshold;
        cursor.nextThreshold=startThreshold+periodSeconds;
        while (cursor.end.column < endColumn) {
          while(cursor.end.timestamp < cursor.nextThreshold) {
            cursor.end.column++;
            cursor.end.timestamp = table.content[0][cursor.end.column];
          }
          if (cursor.end.column-cursor.start.column > 1) {
            result = table[rule.method+'Calc'](rule,table.content[row],cursor.start.column,cursor.end.column);
            if (result!==undefined) {
              switch (rule.resultAt) {
                case 0: resultAt = cursor.start.column; break;
                case 1: resultAt = cursor.end.column; break;
                case 2: resultAt = cursor.start.column + Math.floor((cursor.end.column-cursor.start.column)/2); break;
                case 3: resultAt = -1; break;
              }
              // this.node?.log(`calc range:${cursor.start.column}-${cursor.end.column} @${resultAt}=${result}`);
              if (resultAt>=0) {
                table.content[row][resultAt] = result;
              } else {
                this.addValues(cursor.start.timestamp+((cursor.end.timestamp-cursor.start.timestamp)/2),{index:row,value:result});
              }
          }

          }
          cursor.end.column++;
          cursor.start.column = cursor.end.column;
          cursor.start.timestamp = table.content[0][cursor.start.column];
          cursor.end.timestamp = cursor.start.timestamp;
          cursor.nextThreshold += periodSeconds;
        }
      }
    }
    return endThreshold;
  }
  /** 
   * limit the amount of columns
   * @param {array} rules array of rule objects
   * @return {number} number of removed columns
   **/
  applyReductionRules(rules){
    var table = this;
    table.removedData = 0;
    let startTime = 0;
    let reductionRules = rules.filter(rule => rule.threshold > 0 && rule.older > 0 && rule.enabled);
    reductionRules.sort((a,b)=>{return (b.older*b.threshold) - (a.older*a.threshold);});
    //this.node?.log(`applyScheduledRules sorted`,reductionRules);

    reductionRules.forEach((rule, index) => {
      //this.node?.log(`applied #${index}:"${rule.plugin} start ${startTime}`);
      startTime = table.reduceData(rule,startTime);
      //this.node?.log(`applied #${index}:"${rule.plugin}" next rule start ${startTime}s`)
    });
    return table.removedData;
  }
  /** 
   * limit the amount of columns
   * @param {object} rule rule object containing **columns** property
   * @return {number} number of removed columns
   **/
  limitColumns(rule) {  
    var table = this;
    let toRemove = 0;
    if (table.content[0].length > rule.columns) {
      toRemove = table.content[0].length - rule.columns;
      table.content.forEach(row => row.splice(0,toRemove));
    }
    return toRemove;
  }
  /** 
   * limit the time span
   * @param {object} rule rule object containing **last and period** property
   * @return {number} number of removed columns
  **/
  limitTime(rule) {  
    var table = this;
    if (table.content[0].length < 1) return 0;
    let limit = Date.now()/1000 - (rule.last * rule.period);
    let toRemove = 0;
    while (toRemove < table.content[0].length && table.content[0][toRemove] < limit) { toRemove ++;}    if (toRemove > 0) {
      table.content.forEach(row => row.splice(0,toRemove));
      this.node?.log(`limitTime columns deleted:${toRemove} left: ${table.getWidth()}`);
    }
    return toRemove;
  }
  /**
   * apply a set one rule to the data
   * @param {object} rule object defining the rule
   * @return {number} number of affected columns. -1 if an error accrued
   */
  applyRule(rule) {
    var table = this;
    var result = 0;
    if (typeof table[rule.plugin] === 'function') {
      result += table[rule.plugin](rule);
    } else {
      this.node?.log(`rule plugin "${rule.plugin}" unknown!`);
    }
    return result;
  }
  /**
   * set timers for scheduled rules
   * all existing timers will be canceled
   * @param {array} rules array of objects defining the rules
   * @param {boolean} [client = false] flag if client values should be used
   * @return {number} amount of timers set
   */
  setTimers(rules, client = false) {
    var table = this;
    // clear running timers
    table.schedules.forEach((schedule,index) => {
      clearInterval(table.schedules[index]);
    });
    table.schedules = [];
    // set reduction rules timers
    let reductionRules = rules.filter(rule => rule.threshold > 0 && rule.older > 0 && rule.enabled);
    reductionRules.sort((a,b)=>{return (b.older*b.threshold) - (a.older*a.threshold);});
    var timeBase = Date.now()/1000;
    var startTime = 0;
    reductionRules.forEach(rule => {
      if (!rule.enabled) return;
      rule.startTime = startTime;
      rule.endTime = timeBase - (rule.older * rule.threshold); // advance start time to end of period ("older than")
      
      table.schedules.push(setInterval(() => {
        var scheduledRule = rule;
        table.reduceData(scheduledRule, scheduledRule.startTime);
      },rule.span * rule.periods * 1000));
      startTime = rule.endTime;
      this.node?.log(`scheduler "${rule.plugin}" from ${new Date(rule.startTime*1000).toLocaleDateString()} ${new Date(rule.startTime*1000).toLocaleTimeString()} to ${new Date(rule.endTime*1000).toLocaleDateString()} ${new Date(rule.endTime*1000).toLocaleTimeString()} set for every ${rule.span * rule.periods}s`);
    });

    // set other rules
    rules.forEach((rule,index) => {
      let intervalMs = 0;
      switch (rule.plugin) {
        case 'reduceData': // already handled above
          return;
        case 'limitColumns':
          if (!client && rule.limitColumnsPeriods>0) { // only if by time
            intervalMs = rule.limitColumnsEvery * rule.limitColumnsPeriods * 1000;
          }          if (client && rule.checkEvery>0) {
            intervalMs = rule.checkEvery * 1000;
          }
          break;
          case 'limitTime':
          if (!client && rule.limitColumnsPeriods>0) { // only if by time   
            intervalMs = rule.limitTimeEvery * rule.limitTimePeriods * 1000;
          }          if (client && rule.checkEvery>0) {
            intervalMs = rule.checkEvery * 1000;
          }          
          break;
        case 'cleanTable':
          intervalMs = rule.cleanEvery * rule.cleanPeriod * 1000;
          break;
      }
      if (intervalMs>0 && rule.enabled) {
        table.schedules.push(setInterval(() => {
          var scheduledRule = rule;
          table.applyRule(scheduledRule);
        },intervalMs));
        this.node?.log(`scheduler "${rule.plugin}" every ${intervalMs/1000}s`);
      }
    });
    return table.schedules.length;
  }
  /**
   * apply a set of rules to the data
   * only enabled rules are applied
   * the array will be sorted: 1st limit amount, 2nd limit total time and then scheduled actions
   * @param {array} rules array of objects defining the rules
   * @return {number} number of affected columns. -1 if an error accrued
   */
  applyRules(rules) {
    var table = this;
    var result = 0;
    table.singleRules = rules.filter(rule => rule.plugin === 'limitColumns' && rule.enabled);
    table.singleRules.concat(rules.filter(rule => rule.plugin === 'limitTime' && rule.enabled));

    table.singleRules.forEach((rule,index) => {
      result += table.applyRule(rule);
    });

    result+= table.applyReductionRules(rules);
    return result;
  }
  getSizes() {
    var table = this;
    var result = {
      memoryBytes : 0,
      memoryString : '',
      columns : table.content[0].length,
      rows : table.content.length-1, 
      cellsUsed : 0,
      cellsTotal : table.content[0].length * (table.content.length-1),
      cellsUnused : 0,
      ratio: 1,
      ratioPercent: "100%",
      timeTotal : 0,
    };
    table.content.forEach((row,rowIndex) =>{
      if (rowIndex>0) {
        row.forEach(() => result.cellsUsed++);
      }
    });
    result.memoryBytes = (result.cellsUsed + result.columns) * 8;
    result.memoryString = (result.memoryBytes>1024) ? (result.memoryBytes / 1024).toFixed(2) + 'kb' :
      (result.memoryBytes> 1024*1024) ? (result.memoryBytes / 1024 / 1024).toFixed(2) + 'mb' :
      result.memoryBytes + 'bytes';
    result.cellsUnused = result.cellsTotal - result.cellsUsed;
    if (result.cellsTotal>0) {
      result.ratio = result.cellsUsed / result.cellsTotal;
      result.ratioPercent = (result.ratio*100).toFixed(2)+"%";
    }
    result.timeTotal = table.content[0][table.content[0].length-1] - table.content[0][0];
    return result;
  }
}
// module.exports = TimeTable;

export default TimeTable;
