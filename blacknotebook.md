# Notes
## replay full dataset


1. the $watch code:
```
  $scope.$watch('msg', function(msg) {
      if (!msg) { return; } // Ignore undefined msg
      if ($scope._data[0]===undefined) {
          console.log('uPlot first Message > asking for replay');
          $scope.send({payload:"R"});
          return;
      }
      if (msg.hasOwnProperty('fullDataset')) {
          console.log('uPlot fullDataset received:',msg);
          
          // do something with the full dataset 

          });
      } else if (isNewDataPoint(msg)){
          console.log('uPlot dataPoint received:',msg);

          // do something with the datapoint

      }
  });
```
2. in `beforeSend` trigger let's trigger a message to myself
```
  beforeSend: function (msg, orig) {
      if (orig.msg.payload === 'R') {
          node.receive(orig.msg);
          return;
      }
      if (orig) {
          var newMsg = {};

          // do something here if your node emits data
      }
  },
```
3. in `convert` return the full dataset if a replay is requested

```
  convert: function(value,fullDataset,msg,step) {
      if (msg.payload==='R') {
          return fullDataset;
      }
      var conversion = {
          updatedValues: {
              msg:{
                  fullDataset : []
              }},
          newPoint: {},
      }

      // do your converting business

      return conversion;
  },
```
4. in `beforeEmit` return the full dataset again (if present and well formed)
```
  beforeEmit: function(msg, fullDataset) {
      if (fullDataset && fullDataset.hasOwnProperty('msg') && fullDataset.msg.hasOwnProperty('fullDataset')) {
          return fullDataset 
      };
      
      // prepare your payload ready for launch
      
      return { msg: newMsg };
  },
```