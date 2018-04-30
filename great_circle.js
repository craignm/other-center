"use strict";

var earthRadius = 6371; // kilometers
var earthHalfCircumference = earthRadius * Math.PI;
var myLat = 39.91, myLng = 116.39; // Beijing

var geocoder = new GClientGeocoder();

var radius;
var width = 1000;
var height = 1000;
var transform = "translate(" + width / 2 + "," + height / 2 + ")";

radius = Math.min(width, height) / 2 - 30;

var r = d3.scaleLinear()
  .domain([0, earthHalfCircumference])
  .range([0, radius]);

var line = d3.radialLine()
  .radius(function(d) { return r(d[1]); })
  .angle(function(d) { return -d[0] + Math.PI / 2; });

var svg = d3.select("div#container")
  .append("svg")
  .attr("preserveAspectRatio", "xMidYMid meet")
  .attr("viewBox", "0 0 1000 1000")
  .append("g")
  .attr("transform", transform);

var chart = svg.append("g");

// For zooming and panning
svg.append("rect")
  .attr("x", -width / 2)
  .attr("y", -height / 2)
  .attr("width", width)
  .attr("height", height)
  .style("fill", "none")
  .style("pointer-events", "all")
  .call(d3.zoom()
        .scaleExtent([1 / 2, 4])
        .on("zoom", zoomed));

function zoomed() {
  chart.attr("transform", d3.event.transform);
}

function drawChart() {
  chart.selectAll("*").remove();

  var gr = chart.append("g")
    .attr("class", "r axis")
    .selectAll("g")
    .data(r.ticks(5).slice(1))
    .enter().append("g");

  gr.append("circle")
    .attr("r", r);
  
  var comma = d3.format(",");
  var axisBoundingBoxes = [];
  
  gr.append("text")
    .attr("y", function(d) { return -r(d) - 4; })
    .attr("transform", "rotate(15)")
    .style("text-anchor", "middle")
    .text(function(d) { return comma(d) + " km"; })
    .each(function(d) { axisBoundingBoxes.push([this.getBoundingClientRect(), d]); });

  var cardinalDirections = 
    [[0  , "E"], [45 , "NE"], [90 , "N"], [135, "NW"], 
     [180, "W"], [225, "SW"], [270, "S"], [315, "SE"]];
  
  var ga = chart.append("g")
    .attr("class", "axis")
    .selectAll("g")
    .data(cardinalDirections)
    .enter().append("g")
    .attr("transform", function(d) { return "rotate(" + -d[0] + ")"; });
  
  ga.append("line")
    .attr("x2", radius);
  
  ga.append("text")
    .attr("x", -6)
    .attr("dy", ".35em")
    .attr("transform", function(d) { return "translate(" + (radius + 15) +") rotate(" + d[0] + ")"; })
    .text(function(d) { return d[1]; });
  
  d3.csv("cities.csv", function(cities) {
      drawCoastline(cities, axisBoundingBoxes);
    });
}

drawChart();

function geocodeAddress(address) {
  if (geocoder) {
    geocoder.getLatLng(
		       address,
		       function(point) {
			 if (!point) {
			   return;
			 }
			 myLat = point.lat();
			 myLng = point.lng();
			 drawChart();
		       });
  }
}

// Draw coastline.

function drawCoastline(cities, existingBoundingBoxes) {
  d3.json('coastline.json', function(error, mapData) {
      var coastlines = [];
      var coastlineIndex = 0;
      
      for (var i = 0; i < mapData.features.length; i ++) {
	var coordinates = mapData.features[i].geometry.coordinates;
	var lastBearing = 0;
	coastlines[coastlineIndex] = [];
	
	for (var j = 0; j < coordinates.length; j++) {
	  var bd = bearingAndDistance(myLat, myLng, 
				      +coordinates[j][1], +coordinates[j][0]);
	  // At the edge of the world, segments get too long between points, and look bad.
	  if (lastBearing && Math.abs(lastBearing - bd.bearing).toDegrees() > 10) {
	    coastlineIndex ++;
	    coastlines[coastlineIndex] = [];
	  }
	  coastlines[coastlineIndex].push([Math.PI / 2 - bd.bearing, bd.distance]);
	  lastBearing = bd.bearing;
	}
	coastlineIndex ++;
      }
      
      for (var i = 0; i < coastlines.length; i++) {
	if (coastlines[i].length > 1) {
	  chart.append("path")
	    .datum(coastlines[i])
	    .attr("class", "line")
	    .attr("d", line);
	}
      }
      
      drawCities(cities, existingBoundingBoxes);
    });
}

// City labels

function drawCities(cities, existingBoundingBoxes) {
  for (var i = 0; i < 2000; i ++) {
    if (!cities[i]) {
      break;
    }

    var bd = bearingAndDistance(myLat, myLng, 
				+cities[i].latitude, +cities[i].longitude);

    var point = chart.append("g")
      .attr("transform", 
	    "rotate(" + (bd.bearing.toDegrees() - 90) + ") " +
	    "translate("+ r(bd.distance) +") " +
	    "rotate(" + (90 - bd.bearing.toDegrees()) + ")");

    point.append("text")
      .attr("class", "cityname")
      .attr("x", 6)
      .attr("y", 3)
      .text(cities[i].cityLabel);

    point.append("circle")
      .attr("class", "dot")
      .attr("r", 3.5);
    
    var boundingBox = point.node(0).getBoundingClientRect();

    if (overlaps(boundingBox, existingBoundingBoxes)) {
      point.remove();
    } else {
      existingBoundingBoxes.push([boundingBox, cities[i].cityLabel]);
    }
  }

}

var x;

function overlaps(newBoundingBox, existingBoundingBoxes) {
  var a = newBoundingBox;
  for (var i = 0; i < existingBoundingBoxes.length; i++) {
    var b = existingBoundingBoxes[i][0];
    if (a.left < b.left + b.width && b.left < a.left + a.width &&
	a.top < b.top + b.height && b.top < a.top + a.height) {
      return true;
    }
  }
  return false;
}


/* Extend Number object with method to convert numeric degrees to radians */
if (Number.prototype.toRadians === undefined) {
  Number.prototype.toRadians = function() { return this * Math.PI / 180; };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (Number.prototype.toDegrees === undefined) {
  Number.prototype.toDegrees = function() { return this * 180 / Math.PI; };
}


function bearingAndDistance(lat1, lng1, lat2, lng2) {
  var latR1 = lat1.toRadians();
  var latR2 = lat2.toRadians();
  var ΔlatR = (lat2 - lat1).toRadians();
  var ΔlngR = (lng2 - lng1).toRadians();
  
  var a = 
    Math.sin(ΔlatR / 2) * Math.sin(ΔlatR / 2) +
    Math.cos(latR1) * Math.cos(latR2) *
    Math.sin(ΔlngR / 2) * Math.sin(ΔlngR / 2);

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  var y = Math.sin(ΔlngR) * Math.cos(latR2);
  var x = 
    Math.cos(latR1) * Math.sin(latR2) -
    Math.sin(latR1) * Math.cos(latR2) * Math.cos(ΔlngR);
  
  return { 
    bearing: Math.atan2(y, x),
    distance: earthRadius * c
  }
}
