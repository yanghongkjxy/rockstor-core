/*
 *
 * @licstart  The following is the entire license notice for the 
 * JavaScript code in this page.
 * 
 * Copyright (c) 2012-2013 RockStor, Inc. <http://rockstor.com>
 * This file is part of RockStor.
 * 
 * RockStor is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License,
 * or (at your option) any later version.
 * 
 * RockStor is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 * 
 * @licend  The above is the entire license notice
 * for the JavaScript code in this page.
 * 
 */


CpuUsageWidget = RockStorWidgetView.extend({
  
  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.template = window.JST.dashboard_widgets_cpuusage;
    // maximized size for shapeshift
    this.maxCols = 10;
    this.maxRows = 2;
    this.numSamples = 60;
    this.maxCpus = 8;
    this.modes = ['smode', 'umode', 'umode_nice', 'idle'];
    this.colors = ["#E41A1C", "#377EB8", "#4DAF4A", "#FFFFFF"];
    this.numCpus = null; 
    this.avg = this.genEmptyCpuData(this.numSamples);
    this.cpuNames = [];
    this.allCpuGraphData = null;
    this.allCpuGraphOptions = { 
      grid : { 
        clickable: true,
        show : true,
        borderWidth: {
          top: 1,
          right: 0,
          bottom: 1,
          left: 1
        },
        aboveData: true,
        borderColor: "#ddd",
        color: "#aaa"
      },
			series: {
        stack: true,
        stackpercent : false,
        bars: { show: true, barWidth: 0.9, fillColor: {colors:[{opacity: 1},{opacity: 1}]}, align: "center" },
        lines: { show: false, fill: false },
        shadowSize: 0	// Drawing is faster without shadows
			},
			yaxis: { 
        min: 0, 
        max: 100,
        ticks: 4,
        tickFormatter: this.pctTickFormatter,
        font: { color: "#333" }
      },
      xaxis: { 
        tickLength: 2,
        tickFormatter: this.allCpuTickFormatter(this.cpuNames, this),
        font: { color: "#333" }
      },
      legend: { show: false },
      
    }

    this.graphOptions = { 
      grid : { 
        borderWidth: {
          top: 1,
          right: 1,
          bottom: 1,
          left: 1
        },
        aboveData: true,
        borderColor: "#ddd",
        color: "#aaa"
      },
			series: {
        stack: true,
        stackpercent : false,
        lines: { show: true, fill: 0.5, lineWidth: 1 },
        shadowSize: 0	
			},
			yaxis: { 
        min: 0, 
        max: 100,
        ticks: 4,
        tickFormatter: this.pctTickFormatter,
      },
      xaxis: {  
        tickFormatter: this.cpuTickFormatter,
        tickSize: 12,
        min: 0, 
        max: 60,
      },
      legend : { container : "#cpuusage-legend", noColumns : 4 },
      //tooltip: true,
      //tooltipOpts: { content: "<b>%s</b> (%p.2%)" }
    };

    this.windowLength = 60000; // window length in msec (1 min)
    this.transDuration = 1000; // transition duration
    this.updateFreq = 1000;

    // Start and end timestamps for api call
    this.t2 = RockStorGlobals.currentTimeOnServer.getTime();
    this.t1 = this.t2 - this.windowLength;
    
    // cpu data array 
    this.cpuData = [];

    this.margin = {top: 20, right: 20, bottom: 20, left: 40};
    this.width = 250 - this.margin.left - this.margin.right,
    this.height = 100 - this.margin.top - this.margin.bottom;
    this.padding = {top: 0, right: 0, bottom: 20, left: 0};

  },
 
  allCpuTickFormatter: function(cpuNames, context) {
    return function(val, axis) {
      if (!_.isUndefined(context.cpuNames[val-1])) {
        return context.cpuNames[val-1];
      } else {
        return "";
      }
    }
  },
  
  cpuTickFormatter: function(val, axis) {
    return (5 - (parseInt(val)/12)).toString() + ' m';
  },

  pctTickFormatter: function(val, axis) {
    return val + "%";
  },

  render: function() {
    this.constructor.__super__.render.apply(this, arguments);
    var _this = this;
    $(this.el).html(this.template({
      modes: this.modes,
      colors: this.colors,
      height: this.defaultHeight,
      width: this.defaultWidth,
      displayName: this.displayName
    }));
    
 
    this.getData(this); 
    return this;
  },
  

  getData: function(context) {
    var _this = context;
    
    _this.startTime = new Date().getTime(); 
    var t1Str = moment(_this.t1).toISOString();
    var t2Str = moment(_this.t2).toISOString();
    _this.jqXhr = $.ajax({
      url: "/api/sm/sprobes/cpumetric/?format=json&t1=" + 
        t1Str + "&t2=" + t2Str, 
      type: "GET",
      dataType: "json",
      global: false, // dont show global loading indicator
      success: function(data, status, xhr) {
        data = data.results;
        data = _.filter(data, function(d) { return d.name == 'cpu0';});
        /* 
        if (_.isNull(_this.numCpus)) {
          _this.numCpus = data.length;
        }
        _this.parseData(data); 
        _this.updateGraph();
       */
        if (!_this.graphRendered) {
          console.log(data);
          _this.renderGraph(data);
          _this.graphRendered = true;
        }
        var currentTime = new Date().getTime();
        var diff = currentTime - _this.startTime;
        console.log('diff is ' + diff);
        if (diff > _this.updateFreq) {
          console.log('calling immediately');
          _this.t1 = _this.t2; 
          _this.t2 = _this.t2 + diff;
          //_this.getData(_this); 
        } else {
          console.log('setting timeout');
          _this.timeoutId = window.setTimeout( function() { 
            _this.t1 = _this.t2; 
            _this.t2 = _this.t2 + _this.updateFreq;
            //_this.getData(_this); 
          }, _this.updateFreq - diff);
        }
      },
      error: function(xhr, status, error) {
        logger.debug(error);
      }
    });
  },

  cleanup: function() {
    if (!_.isUndefined(this.timeoutId)) {
      window.clearTimeout(this.timeoutId);
    }
    if (this.jqXhr) {
      this.jqXhr.abort();
    }
  },

  parseData: function(data) {
    var _this = this;
    var tmpSum = {};
    _.each(data, function(d) {
      var cpu = _this.cpuData[d.name];
      if (_.isUndefined(cpu)) {
        cpu = _this.genEmptyCpuData(_this.numSamples );
        _this.cpuData[d.name] = cpu;
      }
      _.each(_this.modes, function(mode) {
        cpu[mode].push(d[mode]);
        cpu[mode].splice(0,1);
        if (!_.isUndefined(tmpSum[mode])) {
          tmpSum[mode] = tmpSum[mode] + d[mode];
        } else {
          tmpSum[mode] = d[mode];
        }
      });
    });
    this.cpuNames = _.keys(this.cpuData);
    _.each(_this.modes, function(mode) {
      tmpSum[mode] = tmpSum[mode]/_this.cpuNames.length;  
      _this.avg[mode].push(tmpSum[mode]);
      _this.avg[mode].splice(0,1);
    })

    _this.allCpuGraphData = [];
    _.each(_this.modes, function(mode, i) {
      var tmp = [];
      _.each(_this.cpuNames, function(name, j) {
        var dm = _this.cpuData[name][mode];
        tmp.push([j+1, dm[dm.length-1]]);
      });
      // Add empty data so that bar width is acc to maxCpus .
      for (var k=_this.numCpus; k<_this.maxCpus; k++) {
        tmp.push([k+1, null]);
      }
      if (mode != 'idle') {
        _this.allCpuGraphData.push({
          "label": mode, 
          "data": tmp, 
          "color": _this.colors[i]
        });
      }

    });
    _this.avgGraphData = [];
    _.each(_this.modes, function(mode, i) {
      var tmp = [];
      _.each(_this.avg[mode], function(d,j) {
        tmp.push([j+1, d]);
      });
      if (mode!= 'idle') {
        _this.avgGraphData.push({
          "label": mode,
          "data": tmp,
          "color": _this.colors[i]
        });
      }
    });
  },

  genEmptyCpuData: function(numSamples) {
    var cpu = {};
    _.each(this.modes, function(mode) {
      cpu[mode] = [];
      for (var i=0; i<numSamples; i++) {
        cpu[mode].push(0); 
      }
    });
    return cpu;
  },

  

  genRawData: function(n) {
    //{"id": 96262, "name": "cpu1", "umode": 188641, "umode_nice": 0, "smode": 269451, "idle": 17115082, "ts": "2013-07-29T00:44:09.250Z"}, 

    var rawData = [];
    for (i=0; i<this.numCpus; i++) {
      var cpu = {name: "cpu" + i};
      cpu.smode = 10 + parseInt(Math.random()*10);
      cpu.umode = 40 + parseInt(Math.random()*10);
      cpu.umode_nice = parseInt(Math.random()*5);
      cpu.idle = 100 - (cpu.smode + cpu.umode + cpu.umode_nice);
      rawData.push(cpu);
    }
    return rawData;
  },

  renderGraph: function(data) {
    var _this = this;
    // Render svg
    this.svg = d3.select(this.el).select('.widget-content')
    .append("svg")
    .attr("class", "cpugraph")
    .attr("width", this.width + this.margin.left + this.margin.right)
    .attr("height", this.height + this.margin.top + this.margin.bottom +
         this.padding.top + this.padding.bottom);

    this.svgG = this.svg.append("g")
    .attr("transform", "translate(" + 
          (this.margin.left + this.padding.left) + "," +
          (this.margin.top + this.padding.top) + ")");
    
    // svg clip path
    this.svgG.append("defs").append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", this.width)
    .attr("height", this.height);
    
    // Scales
    this.x = d3.time.scale().domain([this.t2-this.windowLength, this.t2]).range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);
    this.x.domain(d3.extent(data, function(d) { return new Date(d.ts); }));
    this.y.domain([0, 100]);

    // Line graph
    this.line = d3.svg.line()
    .interpolate('linear')
    .x(function(d) { return _this.x(new Date(d.ts)); })
    .y(function(d) { return _this.y(100 - d.idle); });

    // X Axis
    this.xAxis = this.svgG.append("g")	
    .attr("class", "cpugraph x axis")
    .attr("transform", "translate(0," + this.height + ")")
    .call(this.x.axis = d3.svg.axis().scale(this.x).orient("bottom").ticks(5));

    // X Grid
    this.x.grid = d3.svg.axis()
    .scale(this.x)
    .orient("bottom")
    .ticks(5)
    .tickSize(-this.height, 0, 0)
    .tickFormat('');

    this.xGrid = this.svgG.append("g")	
    .attr("class", "cpugraph grid")
    .attr("transform", "translate(0," + this.height + ")")
    .call(this.x.grid) ;

    var path = this.svgG.append("g")
    .attr("clip-path", "url(#clip)")
    .append("path")
    .data([data])
    .attr("class", "cpugraph line");

    // X axis label
    this.svg.append("text")  
    .attr("x", this.margin.left + this.padding.left + this.width/2 )
    .attr("y",  this.height + 
          this.margin.top + 
          this.padding.top +
          this.margin.bottom +
          this.padding.bottom/2 )
    .style("text-anchor", "middle")
    .text("Time");

    // Y Axis
    this.yAxis = d3.svg.axis().scale(this.y)
    .orient("left").ticks(3);

    this.yGrid = d3.svg.axis()
    .scale(this.y)
    .orient('left')
    .ticks(5)
    .tickSize(-this.width, 0, 0)
    .tickFormat('')

    this.svgG.append("g")			// Add the Y Axis
    .attr("class", "cpugraph y axis")
    .call(this.yAxis);

    this.svgG.append("g")			// Add the Y Grid
    .attr("class", "cpugraph grid")
    .call(this.yGrid);

    // Y axis label
    this.svgG.append("text")  
    .attr("x", 0-(this.height/2) )
    .attr("y",  0 - (this.margin.left/2)  )
    .style("text-anchor", "middle")
    .text("Value")
    .attr("transform", "rotate(-90)");
  
    this.svgG.select(".line")
    .attr("d", this.line)
    .attr("transform", null);

  },

  updateGraph: function(data) {
    /*
    //this.allCpuGraphOptions.xaxis.ticks = this.cpuNames.length;
    this.allCpuGraphOptions.xaxis.ticks = this.maxCpus;
    $.plot($("#cpuusage-all"), this.allCpuGraphData, this.allCpuGraphOptions);
    //$("#cpuusage-all").bind("plotclick", function(event, pos, item) {
    //});
    $.plot($("#cpuusage"), this.avgGraphData, this.graphOptions);
   */
  },

});

// Default configuration for cpu widget
RockStorWidgets.widgetDefs.push({ 
  name: 'cpuusage', 
  displayName: 'CPU', 
  view: 'CpuUsageWidget',
  description: 'CPU Utilization',
  defaultWidget: true,
  rows: 1,
  cols: 5,
  maxRows: 2,
  maxCols: 10,
  category: 'Compute',
  position: 1
});

