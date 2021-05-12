console.log(d3)

let width = 960,
    height = 700,
    centered;


// Promise format does not work with d3 version 3
Promise.all([
    d3.json("thailand.json"),
    d3.csv("coordinates.csv"),
    //d3.csv("coordinatesJan29.csv"),
    //d3.csv("coordinatesJan30.csv")
]).then( ([mapData ,coordinates]) => {
    test(mapData, coordinates)

})


function test(mapData, coordinates) {
    // New way to filter the data. Jan 28 is the first day in coordinates.csv
    //var onDate = 0;
    var allGroup = d3.map(coordinates, function(d){return(d.acq_date);});
    let uniqueDates = allGroup.filter((item, i, ar) => ar.indexOf(item) === i);

    var dataForDate = coordinates.filter(function(d) {
        return d["acq_date"] === uniqueDates[0]
    });


    var slider = document.getElementById("mySlider"),
        output = document.getElementById("demo");

    slider.setAttribute("max", (uniqueDates.length - 1));

    output.innerHTML = uniqueDates[slider.value];
    slider.oninput = function () {
        //console.log(document.getElementById("mySlider").value);
        logKey();
        output.innerHTML = uniqueDates[slider.value];

    }

    var map = new L.Map("map", {center: [13.7, 100.5], zoom: 5, minZoom: 4, maxZoom: 12})
        .addLayer(new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"));


    // Add provinces

    var provinces = new Array;
    var j;
    for (j = 0; j < mapData.features.length; j++) {
        provinces.push(mapData.features[j]);
    }

    var geojson;
    function addStates() {

        geojson = L.geoJSON(provinces, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    }
    addStates();

    function style(feature) {
        if (map.getZoom() > 9) {
            return {
                "color": "blue",
                "weight" : "0",
                "fillOpacity": "0"
            }
        } else {
            return {
                "color": "blue",
                "fillOpacity": "0"
            }
        }
    }

    function onEachFeature(feature, layer) {
        layer.on({
            click: zoomToFeature
        });
    }

    function zoomToFeature(e) {
        map.flyToBounds(e.target.getBounds());
        console.log("The name of the province is" + e.target.feature.properties.name);

        // Need to reset and make all the dots yellow again.
        for (var i = 0; i < dataForDate.length; i++) {
            allCircles[i].setAttribute("fill", "#FFD061");
        }

        document.querySelector('#provinceName').innerHTML = e.target.feature.properties.name;
        var j;
        console.log("starting zoom");
        firesInsideProvince(e.target.feature);
        for(j = 1; j < dataForDate.length; j++) {
            //console.log("Is it inside? " + d3.geoContains(states[1], [coordinates[j].latitude, coordinates[j].longitude]));
            // Need to do projections on the province
            // *** This function does not work
            // console.log("Is it inside? J: " + j + ": " + d3.geoContains(states[1], [coordinates[j].longitude, coordinates[j].latitude]));
            //console.log("Is it inside? " + d3.geoContains(e.target, [coordinates[j].longitude, coordinates[j].latitude]));

        }

        function firesInsideProvince(feature) {
            var allCoord = new Array;
            var i;
            for(i = 0; i < dataForDate.length; i++) {
                if(d3.geoContains(feature, [dataForDate[i].longitude, dataForDate[i].latitude])) {
                    //console.log(allCircles[i]);
                    allCircles[i].setAttribute("fill", "red");
                    allCoord.push(dataForDate[i]);
                }
            }
            //console.log(allCoord);
        }
    }




    // Finds the overlayPane div and places 2 svgs inside. The second has a class name of "circle-layer"
    // There is also a g div in the first svg with a name of "leaflet-zoom-hide"
    var svg1 = d3.select(map.getPanes().overlayPane).append("svg").attr("class", "circle-layer"),
        g1 = svg1.append("g").attr("class", "inner-CL");

    // This takes the path and fits the projection on it using the function below
    var transform = d3.geoTransform({point: projectPoint}),
        path = d3.geoPath().projection(transform);


    // Creates all the circle elements in the circle-layer div
    g1.selectAll("circle")
        .data(dataForDate)
        .enter().append("circle");

    g1.attr("id", "inner-CL");

    // Selector. Selects all the circle elements in the circle-layer div
    var allCircles = document.querySelectorAll(".inner-CL > circle");

    const table = document.querySelector('#wildfireInfo')

    // Sets all the attributes for each circle element
    for (var i = 0; i < dataForDate.length; i++) {
        if (coordinates[i].latitude > 5 && dataForDate[i].latitude < 20) {
            if (dataForDate[i].longitude > 98 && dataForDate[i].longitude < 105) {
                allCircles[i].classList.add(i);
                allCircles[i].setAttribute("r", 4)
                allCircles[i].setAttribute("stroke-width", 1);
                allCircles[i].setAttribute("stroke", "#4F442B");
                allCircles[i].setAttribute("fill", "#FFD061");
                allCircles[i].setAttribute("cx", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).x);
                allCircles[i].setAttribute("cy", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).y);
                allCircles[i].onclick = function () {

                    wildfireID = this.className.animVal

                    console.log(wildfireID)

                    console.log(coordinates[wildfireID])

                    // console.log(document.querySelector('#acqDate').innerHTML)

                    document.querySelector('#acqDate').innerHTML = dataForDate[wildfireID].acq_date
                    document.querySelector('#acqTime').innerHTML = dataForDate[wildfireID].acq_time
                    document.querySelector('#latitude').innerHTML = dataForDate[wildfireID].latitude
                    document.querySelector('#longitude').innerHTML = dataForDate[wildfireID].longitude
                    document.querySelector('#dOrN').innerHTML = dataForDate[wildfireID].daynight
                    document.querySelector('#satellite').innerHTML = dataForDate[wildfireID].satellite
                    document.querySelector('#version').innerHTML = dataForDate[wildfireID].version

                };
                allCircles[i].onmouseover = function () {

                    d3.select(this).style('fill', '#F50D00')

                }
                allCircles[i].onmouseout = function () {

                    d3.select(this).style('fill', '#FFD061')

                }
            }
        }
    }

    // TODO when you zoom in too much this isnt big enought. Need to calculate and update.
    svg1.attr("width", 2000)
        .attr("height", 2000)
        .attr("pointer-events", "none"); // TODO, this prevents us from hovering over provinces




    function logKey(e) {
        //TODO Keep track of the current data variable. Then go between dates for a set number of days you set
        //log.textContent += ` ${e.code}`;
        console.log("slider value: " + document.getElementById("mySlider").value);

        dataForDate = coordinates.filter(function(d) {
            return d["acq_date"] === uniqueDates[document.getElementById("mySlider").value]
        });

        const node = document.getElementById("inner-CL");
        node.innerHTML = "";

        g1.selectAll("circle")
            .data(dataForDate)
            .enter().append("circle");

        // Selector. Selects all the circle elements in the circle-layer div
        allCircles = document.querySelectorAll(".inner-CL > circle");

        // Sets all the attributes for each circle element

        for(var i = 0; i < dataForDate.length; i++) {
            if (dataForDate[i].latitude > 4 && dataForDate[i].latitude < 21) {
                if (dataForDate[i].longitude > 95 && dataForDate[i].longitude < 107) {
                    allCircles[i].classList.add(i);
                    allCircles[i].setAttribute("r", 4)
                    allCircles[i].setAttribute("stroke-width", 1);
                    allCircles[i].setAttribute("stroke", "#4F442B");
                    allCircles[i].setAttribute("fill", "#FFD061");
                    allCircles[i].setAttribute("cx", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).x);
                    allCircles[i].setAttribute("cy", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).y);
                    allCircles[i].onclick = function () {
                        console.log("testing");
                        wildfireID = this.className.animVal

                        console.log(wildfireID)

                        console.log(dataForDate[wildfireID])

                        // console.log(document.querySelector('#acqDate').innerHTML)

                        document.querySelector('#acqDate').innerHTML = dataForDate[wildfireID].acq_date
                        document.querySelector('#acqTime').innerHTML = dataForDate[wildfireID].acq_time
                        document.querySelector('#latitude').innerHTML = dataForDate[wildfireID].latitude
                        document.querySelector('#longitude').innerHTML = dataForDate[wildfireID].longitude
                        document.querySelector('#dOrN').innerHTML = dataForDate[wildfireID].daynight
                        document.querySelector('#satellite').innerHTML = dataForDate[wildfireID].satellite
                        document.querySelector('#version').innerHTML = dataForDate[wildfireID].version

                    };
                    allCircles[i].onmouseover = function () {

                        d3.select(this).style('fill', '#F50D00')

                    }
                    allCircles[i].onmouseout = function () {

                        d3.select(this).style('fill', '#FFD061')

                    }
                }
            }
        }
    }

    map.on("zoom", reset);

    map.on("zoomend", function(){
        geojson.removeFrom(map);
        addStates();
    });
    reset();

    // This function runs on zoom. It needs to redraw the path and dots and set the svg sizes
    function reset() {
        console.log("Starting reset");
        var bounds = path.bounds(mapData),
            topLeft = bounds[0],
            bottomRight = bounds[1];

        // TODO fix this width and height

        /*svg.attr("width", 10000)
            .attr("height", 10000)
            .attr("width", bottomRight[0] - topLeft[0])
            .attr("height", bottomRight[1] - topLeft[1])
            .style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px")
            .attr("d", function (d) {
                return path(d)
            })
            .attr("stroke-width", 2)
            .attr("stroke", "blue")
            .attr("fill", "transparent");
            */

        // THIS IS THE STYLE FOR THE CIRCLE LAYER
        // lat is between 5-20
        // long is between 98 and 105
        svg1.style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px")
            .attr("width", 2000*map.getZoom())
            .attr("height", 2000*map.getZoom());

        //g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

        g1.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")")
            .attr("pointer-events", "all");;

        //svg1.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")")

        /*feature.attr("d", path)
            .on("mouseover", function(d) {
                d3.select(this).style("fill", d => "blue");
            })
            .on("mouseout", function(d) {
                d3.select(this).style("fill", d => "transparent");
            })
            .on("click", function(d) {
                //console.log("STINKY");
                //console.log(d3.select(this)._groups[0][0].__data__);
                //console.log(path.bounds(d3.select(this)._groups[0][0].__data__));
                var testing = path.bounds(d3.select(this)._groups[0][0].__data__);
                var testing2 = path.centroid(d3.select(this)._groups[0][0].__data__);

                console.log(testing2);
                allCircles[0].setAttribute("r", 7)
                allCircles[0].setAttribute("stroke-width", 1);
                allCircles[0].setAttribute("stroke", "#4F442B");
                allCircles[0].setAttribute("fill", "red");
                console.log(map.unproject(testing2, map.getZoom()));
                allCircles[0].setAttribute("cx", map.unproject(testing2, map.getZoom()).lat);
                allCircles[0].setAttribute("cy", map.unproject(testing2, map.getZoom()).lng);


                var coord1 = map.unproject([testing[0][1], testing[0][0]], map.getZoom());
                //var coord2 = map.unproject([testing[1][1], testing[1][0]], map.getZoom());
                // path.bounds(d3.select(this)._groups[0][0].__data__)
                map.flyToBounds([coord2, coord1], {
                    'animate': true,
                    'duration': 2
                });

            });*/

        const allCircles = document.querySelectorAll(".inner-CL > circle");
        for(i = 0; i < dataForDate.length; i++) {
            allCircles[i].setAttribute("cx", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).x);
            allCircles[i].setAttribute("cy", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).y);
        }
    }


    function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }

}