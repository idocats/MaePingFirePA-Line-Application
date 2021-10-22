// import { createRequire } from "module";
// const require = createRequire(import.meta.url);
// const mysqlConnection = require("./testconnection");

document.getElementById("wrapper").style.visibility = "hidden"

let width = 960,
    height = 700,
    centered;

// Promise.all first loads these files and will run the function afterwards.
Promise.all([
    d3.json("thailand.json"),
]).then(([provinceData]) => {
    fetch('/getdata', {
        method:'POST',
        body: JSON.stringify( { 'query' : 'SELECT * FROM nasafirmdata order by acq_date'} ),
        headers : {
            "Content-Type" : "application/json"
        }
    })
        .then(res => res.json())
        .then(coordinate_data => {
            fetch('/getdata', {
                method:'POST',
                body: JSON.stringify( { 'query' : 'SELECT * FROM fires_per_province order by date'} ),
                headers : {
                    "Content-Type" : "application/json"
                }
            }).then(res => res.json())
                .then(fire_data => {
                    createMap(provinceData, coordinate_data, fire_data)
                })

        })
})


/**
 * This function is everything from creating the leaflet map to drawing the geoJSON
 * provinces, plotting the wildfire data using D3, and doing all the map interactions (zooming, slider, tables)
 * @param provinceData the geoJSON file with the province data
 * @param coordinates the csv file with the wildfire data
 */
function createMap(provinceData, coordinates, fire_data) {
    console.log(coordinates)

    var allGroup = d3.map(coordinates, function(d){return(d.acq_date);}); // This takes the entire column for the date
    let uniqueDates = allGroup.filter((item, i, ar) => ar.indexOf(item) === i);
    console.log(uniqueDates)
    var dataForDate = coordinates.filter(function(d) {
        return d["acq_date"] === uniqueDates[0]
    });

    var slider = document.getElementById("mySlider"),
        displayed_date = document.getElementById("displayed_date");
    slider.setAttribute("max", (uniqueDates.length - 1)); // set the number of slider points to be equal to the number of unique dates from the data
    displayed_date.innerHTML = "Date: " + uniqueDates[slider.value]; // Oudisplayed_datetput the slider value to equal the date so the user knows what data is currently being shown
    slider.oninput = function () {
        changeDate();
        displayed_date.innerHTML = "Today's Date: " + uniqueDates[slider.value];
    }

    // Create/attach the leaflet map to our map div.
    var map = new L.Map("map", {center: [13.7, 100.5], zoom: 5, minZoom: 4, maxZoom: 12})
    map.addLayer(new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"));
    // document.getElementById("map").setAttribute("position", "absolute")
    // document.getElementById("map").setAttribute("margin", "0px")
    // document.getElementById("map").setAttribute("width", "100%")
    // document.getElementById("map").setAttribute("height", "100%")
    // document.getElementById("map").setAttribute("padding", "0px")
    // document.getElementById("map").setAttribute("outline", "none")

    map.on("zoom", reset); // When the user zooms in or out, this function should run
    map.on("zoomend", function(){
        for(let i = 0; i < geojson.length; i++) {
            geojson[i].removeFrom(map);
        }
        addProvinces();
    });

    // Add provinces from geoJSON file.
    // Create a new array and parse through the provinceData file to get the geoJSON object itself and add it to the array
    var provinces = new Array;
    var j;
    for (j = 0; j < provinceData.features.length; j++) {
        provinces.push(provinceData.features[j]);
    }

    var geojson = [];
    function addProvinces() {
        provinces.forEach(province => {
            let item = L.geoJSON(province, {
                style: style(province.properties.name),
                onEachFeature: onEachFeature
            }).addTo(map);
            geojson.push(item)
        })
    }

    addProvinces();

    // Styles the geoJSON provinces
    function style(province_name) {
        if (map.getZoom() > 9) {
            return {
                "color": "red",
                "weight" : "0",
                "fillOpacity": "0"
            }
        } else {
            // If avg is positive, make fillOpacity = 0.2, otherwise fillOpacity = 0
            let averages_array = runningAverageCalcForProvince(province_name)
            if(averages_array[document.getElementById("mySlider").value].value > 0) {
                return {
                    "color": "red",
                    "fillOpacity": "0.2"
                }
            }
            else {
                return {
                    "color": "red",
                    "fillOpacity": "0"
                }
            }
        }
    }

    // What gets added to each province object. For this, we just tell it what to do when its clicked
    function onEachFeature(feature, layer) {
        layer.on({
            click: zoomToFeature
        });
    }

    // What happens when you clean on the geoJSON feature.
    // e is the mouse event. e.target is the province object
    function zoomToFeature(e) {
        let province_name = e.target.feature.properties.name
        console.log(province_name)
        drawBarGraph(get_fire_data_query('SELECT * FROM ? WHERE name="' + province_name + '"'), province_name)

        map.flyToBounds(e.target.getBounds());
        console.log("The name of the province is " + province_name);

        // Need to reset and make all the dots yellow again.
        for (var i = 0; i < dataForDate.length; i++) {
            allCircles[i].setAttribute("fill", "#FFD061");
        }

        document.querySelector('#provinceName').innerHTML = e.target.feature.properties.name; // Selector for the dots in the specific province you clicked on
        var j;
        console.log("starting zoom");
        firesInsideProvince(e.target.feature);

        // This function finds all the dots within the feature and make them red
        function firesInsideProvince(feature) {
            allCoord = new Array;
            var i;
            for(i = 0; i < dataForDate.length; i++) {
                if(d3.geoContains(feature, [dataForDate[i].longitude, dataForDate[i].latitude])) {
                    allCircles[i].setAttribute("fill", "red");
                    allCoord.push(dataForDate[i]);
                }
            }
            console.log(allCoord);
        }
    }

    // Finds the overlayPane div and places an svg layer inside that has a class name of "circle-layer"
    // There is also a g div in the svg with a name of "inner-CL"
    // svg1 is essentially just the bounds for the wildfire data. If a circle is places outside of this layer, it will not be shown on the page
    // g1 contains all the circles. Here, we can put styles that are similar to all data.
    var svg1 = d3.select(map.getPanes().overlayPane).append("svg").attr("class", "circle-layer"),
        g1 = svg1.append("g").attr("class", "inner-CL");

    var transform = d3.geoTransform({point: projectPoint}),
        path = d3.geoPath().projection(transform);

    g1.selectAll("circle")
        .data(dataForDate)
        .enter().append("circle");

    g1.attr("id", "inner-CL");

    // Selector. Selects all the circle elements in the inner-CL div
    var allCircles = document.querySelectorAll(".inner-CL > circle");

    const table = document.querySelector('#wildfireInfo')

    // Sets all the attributes for each circle element
    for (var i = 0; i < dataForDate.length; i++) {
        if (coordinates[i].latitude > 5 && dataForDate[i].latitude < 20) { // This only sets attributes if the coordinates are within this latitude
            if (dataForDate[i].longitude > 98 && dataForDate[i].longitude < 105) { // and within this longitude
                allCircles[i].classList.add(i);
                allCircles[i].setAttribute("r", 4);
                allCircles[i].setAttribute("stroke-width", 1);
                allCircles[i].setAttribute("stroke", "#4F442B");
                allCircles[i].setAttribute("fill", "#FFD061");
                allCircles[i].setAttribute("cx", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).x); // This projects the coordinate from LatLng to the correct pixel on the webpage
                allCircles[i].setAttribute("cy", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).y);

                // This function runs when the dot is clicked
                allCircles[i].onclick = function () {

                    wildfireID = this.className.animVal

                    console.log(wildfireID)
                    console.log(coordinates[wildfireID])

                    // Updates the table with the correct information for that specific wildfire
                    document.querySelector('#acqDate').innerHTML = dataForDate[wildfireID].acq_date
                    document.querySelector('#acqTime').innerHTML = dataForDate[wildfireID].acq_time
                    document.querySelector('#latitude').innerHTML = dataForDate[wildfireID].latitude
                    document.querySelector('#longitude').innerHTML = dataForDate[wildfireID].longitude
                    document.querySelector('#dOrN').innerHTML = dataForDate[wildfireID].daynight
                    document.querySelector('#satellite').innerHTML = dataForDate[wildfireID].satellite
                    document.querySelector('#version').innerHTML = dataForDate[wildfireID].version
                };

                // What happens when the mouse hovers over the dot
               allCircles[i].onmouseover = function () {
                   this.setAttribute('fill', '#F50D00')
                }

                // What happens when the mouse no longer hovers over the dot
                allCircles[i].onmouseout = function () {
                    this.setAttribute('fill', '#FFD061')
                }
            }
        }
    }

    svg1.attr("width", 2000)
        .attr("height", 2000)
        .attr("pointer-events", "none"); // This allows us to click through the svg layer so that we can click on the dots



    function changeDate(e) {
        for(let i = 0; i < geojson.length; i++) {
            geojson[i].removeFrom(map);
        }
        addProvinces();

        // console.log("slider value: " + document.getElementById("mySlider").value);

        // Update the desired date
        dataForDate = coordinates.filter(function(d) {
            return d["acq_date"] === uniqueDates[document.getElementById("mySlider").value]
        });

        const node = document.getElementById("inner-CL"); // find the inner-CL div
        node.innerHTML = ""; // delete all the circle elements that were in the inner-CL div

        g1.selectAll("circle")
            .data(dataForDate)
            .enter().append("circle"); // Like before, this created the correct number of circle elements in this layer depending on the date

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
                        wildfireID = this.className.animVal

                        console.log(wildfireID)
                        console.log(dataForDate[wildfireID])

                        document.querySelector('#acqDate').innerHTML = dataForDate[wildfireID].acq_date
                        document.querySelector('#acqTime').innerHTML = dataForDate[wildfireID].acq_time
                        document.querySelector('#latitude').innerHTML = dataForDate[wildfireID].latitude
                        document.querySelector('#longitude').innerHTML = dataForDate[wildfireID].longitude
                        document.querySelector('#dOrN').innerHTML = dataForDate[wildfireID].daynight
                        document.querySelector('#satellite').innerHTML = dataForDate[wildfireID].satellite
                        document.querySelector('#version').innerHTML = dataForDate[wildfireID].version
                    };

                    allCircles[i].onmouseover = function () {
                        this.setAttribute('fill', '#F50D00')
                    }
                    allCircles[i].onmouseout = function () {
                        this.setAttribute('fill', '#FFD061')
                    }

                }
            }
        }
    }

    reset();

    /**
     * This function runs every time the map zooms in or out. The point of this, is that the svg1 layer
     * needs to recalculate how big it is. The wildfire data also needs to recalculate where to draw itself.
     */
    function reset() {
        let bounds = path.bounds(provinceData),
            topLeft = bounds[0],
            bottomRight = bounds[1];

        svg1.style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px")
            .attr("width", 2000*map.getZoom())
            .attr("height", 2000*map.getZoom());

        g1.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")")
            .attr("pointer-events", "all");;

        const allCircles = document.querySelectorAll(".inner-CL > circle");
        for(i = 0; i < dataForDate.length; i++) {
            allCircles[i].setAttribute("cx", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).x);
            allCircles[i].setAttribute("cy", map.latLngToLayerPoint(new L.LatLng(dataForDate[i].latitude, dataForDate[i].longitude)).y);
        }
    }

    // Converts a LatLng to a correct pixel for the webpage so that its in the correct location in the leaflet map.
    function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }

    function get_coordinate_data_query(query) {
        return alasql(query,[coordinates]);
    }

    function get_fire_data_query(query) {
        return alasql(query,[fire_data]);
    }

    function drawLineChart(dataset, province_name) {
        was_draw_line_created = true
        document.getElementById("wrapper").style.visibility = "visible"

        const yAccessor = (d) => d.numWildfires;
        const dateParser = d3.timeParse("%Y-%m-%d");
        const xAccessor = (d) => (dateParser(d.date));
        // const xAccessor = (d) => (d.date);
        // console.log(dataset[0].date)
        // console.log(dateParser(dataset[0].date))
        // console.log(typeof dateParser(dataset[0].date))

        //Check the value of xAccessor function now
        //console.log(xAccessor(dataset[0]));

        // 2. Create a chart dimension by defining the size of the Wrapper and Margin
        // console.log("wiindow.innerwidth*0.6", window.innerWidth * 0.6)
        let dimensions = {
            width: 579.6,//window.innerWidth * 0.6,
            height: 600,
            margin: {
                top: 25,
                right: 25,
                bottom: 25,
                left: 25,
            },
        };
        dimensions.boundedWidth =
            dimensions.width - dimensions.margin.left - dimensions.margin.right;
        dimensions.boundedHeight =
            dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

        // 3. Draw Canvas
        console.log("before selecting wrapper")
        // clear canvas
        document.getElementById("wrapper").innerHTML = ""

        const wrapper = d3
            .select("#wrapper")
            .append("svg")
            .attr("x", "20px") // was 0
            .attr("y", "0px")
            .attr("width", "500") // was dimensions.width
            .attr("height", "650") // was dimendsion.height
            .attr("viewBox", "0 0 500 800");
        //             x: 0px;
        //             y:0px;
        //             width: 500px;
        //             height:650px;
        //             viewBox:"0 0 500 800";

        //Log our new Wrapper Variable to the console to see what it looks like
        //console.log(wrapper);

        // 4. Create a Bounding Box
        console.log("before creating bounds")
        const bounds = wrapper
            .append("g")
            .style(
                "transform",
                `translate(${dimensions.margin.left}px,${dimensions.margin.top}px)`
            );

        // 5. Define Domain and Range for Scales

        const yScale = d3
            .scaleLinear()
            .domain([0,d3.max(dataset, yAccessor)])
            .range([dimensions.boundedHeight, 0]);

        console.log("creating rect")
        console.log(yScale(100))
        const referenceBandPlacement = yScale(d3.max(dataset, yAccessor));
        const referenceBand = bounds
            .append("rect")
            .attr("x", 0)
            .attr("width", dimensions.boundedWidth)
            .attr("y", referenceBandPlacement)
            .attr("height", dimensions.boundedHeight - referenceBandPlacement)
            .attr("fill", "#ffece6");
        console.log("rect created")
        const xScale = d3
            .scaleTime()
            .domain(d3.extent(dataset, xAccessor))
            .range([0, dimensions.boundedWidth]);

        //6. Convert a datapoints into X and Y value

        const lineGenerator = d3
            .line()
            .x((d) => xScale(xAccessor(d)))
            .y((d) => yScale(yAccessor(d)))
            .curve(d3.curveBasis);

        // 7. Convert X and Y into Path

        const line = bounds
            .append("path")
            .attr("d", lineGenerator(dataset))
            .attr("fill", "none")
            .attr("stroke", "Red")
            .attr("stroke-width", 2);

        //8. Create X axis and Y axis
        // Generate Y Axis

        const yAxisGenerator = d3.axisLeft().scale(yScale);
        const yAxis = bounds.append("g").call(yAxisGenerator)
            .style("height", "400px");

        // Generate X Axis
        // need to count num months TODO how do we do this

        function monthDiff(startDate, endDate) {
            startDate = new Date(startDate);
            endDate = new Date(endDate);
            return Math.max(
                (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                endDate.getMonth() -
                startDate.getMonth(),
                0)
        }

        let num_months = monthDiff(dataset[0].date, dataset[dataset.length-1].date)

        const xAxisGenerator = d3.axisBottom().ticks(num_months).scale(xScale);
        const xAxis = bounds
            .append("g")
            .call(xAxisGenerator.tickFormat(d3.timeFormat("%b")))
            .style("transform", `translateY(${dimensions.boundedHeight}px)`);

        //9. Add a Chart Header

        wrapper
            .append("g")
            .style("transform", `translate(${50}px,${15}px)`)
            .append("text")
            .attr("class", "title")
            .attr("x", dimensions.width / 2)
            .attr("y", dimensions.margin.top / 2)
            .attr("text-anchor", "middle")
            .text("Data for " + province_name)
            .style("font-size", "36px")
            .style("text-decoration", "underline");

        d3.select("#wrapper").append("rect")
            .attr("height", "30px")
            .attr("width", "30px")
            .attr("id", "delete_button_graph")
            .attr("x", "85%")

        document.getElementById("delete_button_graph").onclick= function() {
            console.log("clicked")
            document.getElementById("wrapper").style.visibility = "hidden"
        }
    }

    function drawBarGraph(data, province_name) {
        document.getElementById("bar_graph").innerHTML = ""
        document.getElementById("bar_graph").style.visibility = "visible"

        var svg = d3.select("#bar_graph"),
            // margin = 200,
            width = svg.attr("width"),
            height = svg.attr("height");


        var xScale = d3.scaleBand().range ([0, width]).padding(0.4),
            yScale = d3.scaleLinear().range ([height, 0]);

        var g = svg.append("g")
            .attr("transform", "translate(" + 20 + "," + 20 + ")");

        console.log("height height: ", g.get)

        g.append("rect")
            .attr("transform", "translate(" + -20 + "," + -20 + ")")
            .attr("width", "110%")
            .attr("height", "115%")
            .attr("style", "fill: rgb(166 166 166 / 96%);")

        // Step 2
        xScale.domain(data.map(function(d) { return d.date; }));
        yScale.domain([0, d3.max(data, function(d) { return d.numWildfires; })]);

        g.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xScale));

        g.append("g")
            .call(d3.axisLeft(yScale).tickFormat(function(d){
                return d;
            }).ticks(10))
            .append("text")
            .attr("y", 6)
            .attr("dy", "0.71em")
            .attr("text-anchor", "end")
            .text("value");

        g.selectAll(".bar")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function(d) { return xScale(d.date); })
            .attr("y", function(d) { return yScale(d.numWildfires); })
            .attr("width", xScale.bandwidth())
            .attr("height", function(d) { return height - yScale(d.numWildfires); });

        let delete_button = document.createElement("rect")
        const delete_func = function() {
            document.getElementById("bar_graph").style.visibility = "hidden"
        }

        g.append("rect")
            .attr("height", "30px")
            .attr("width", "30px")
            .attr("id", "delete_button_bar")
            .attr("x", "85%")

        document.getElementById("delete_button_bar").onclick= function() {
            console.log("clicked")
            document.getElementById("bar_graph").style.visibility = "hidden"
        }
            // .attr("onClick", delete_func)

    }

    function runningAverageCalcForProvince(province) {
        function get_7_day_average(day1, day2, day3, day4, day5, day6, day7) {
            return (day1 + day2 + day3 + day4 + day5 + day6 + day7)/7
        }
        let fireData = get_fire_data_query(`SELECT * FROM ? WHERE name="${province}"`);
        let averages = []
        let i;
        for(i = 0; i < 6; i++) {
            averages.push( {date: fireData[i].date, value: -999} )
        }
        for(i = 6; i < fireData.length; i++) {
            let average = get_7_day_average(fireData[i-6].numWildfires, fireData[i-5].numWildfires, fireData[i-4].numWildfires, fireData[i-3].numWildfires, fireData[i-2].numWildfires, fireData[i-1].numWildfires, fireData[1].numWildfires)
            let tot = fireData[i].numWildfires - average
            averages.push({date: fireData[i].date, value: tot}) // if positive, higher than usual. If negative, lower than usual
        }
        return averages
    }

    function runningAverageCalcForThailand(fireData) {
        function get_7_day_average(day1, day2, day3, day4, day5, day6, day7) { return (day1 + day2 + day3 + day4 + day5 + day6 + day7)/7 }
        let averages = []
        for(let i = 6; i < fireData.length; i++) {
            let average = get_7_day_average(fireData[i-6].numWildfires, fireData[i-5].numWildfires, fireData[i-4].numWildfires, fireData[i-3].numWildfires, fireData[i-2].numWildfires, fireData[i-1].numWildfires, fireData[1].numWildfires)
            averages.push({date: fireData[i].date, numWildfires: average})
        }
        return averages
    }

    runningAverageCalcForProvince("Mae Hong Son");

    let was_draw_line_created = false

    document.getElementById("showTrend").onclick = () => {
        if(was_draw_line_created) {
            if(document.getElementById("wrapper").style.visibility == "hidden") {
                document.getElementById("wrapper").style.visibility = "visible"
            }
            else {
                document.getElementById("wrapper").style.visibility = "hidden"

            }
        }
        else {
            let thailand_sum = get_fire_data_query('SELECT date, sum(numWildfires) as numWildfires FROM ? group by date')
            let thailand_avg = runningAverageCalcForThailand(thailand_sum)
            drawLineChart(thailand_avg, "Thailand")
        }

    }

    document.getElementById("affectedRegions").onclick = () => {
            document.getElementById("my_dataviz_container").style.display = "block";
            document.getElementById('my_dataviz').innerHTML ="";
            var date = uniqueDates[slider.value];
            let fireData = get_fire_data_query(`SELECT * FROM ? WHERE date ='${date}'`)
            var provincesWithFireCount = fireData

            // sort by value
            provincesWithFireCount.sort(function (a, b) {
                return a.numWildfires - b.numWildfires;
            });

            var yname = []
            var xcount = []

            for (let k = 0; k < provincesWithFireCount.length; k++) {
                yname.push(provincesWithFireCount[k].name)
            }

            for (let yc = 0; yc < provincesWithFireCount.length; yc++) {
                xcount.push(provincesWithFireCount[yc].numWildfires)
            }

            //remove zero from xcount
            function removeElementsWithValue(arr, val) {
                var i = arr.length;
                while (i--) {
                    if (arr[i] === val) {
                        arr.splice(i, 1);
                    }
                }
                return arr;
            }

            removeElementsWithValue(xcount, 0)
            removeElementsWithValue(xcount, 1)
            removeElementsWithValue(xcount, 2)
            console.log(xcount)
            console.log(provincesWithFireCount)

            var xl = 77 - xcount.length;
            while(xl--){
                yname.shift()
            }

            // set the dimensions and margins of the graph
            const margin = {top: 100, right: 0, bottom: 0, left: 0},
                width = 460 - margin.left - margin.right,
                height = 460 - margin.top - margin.bottom,
                innerRadius = 90,
                outerRadius = Math.min(width, height) / 2;   // the outerRadius goes from the middle of the SVG area to the border

            // append the svg object
            const svg = d3.select("#my_dataviz")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${width/2+margin.left}, ${height/2+margin.top})`);

            for (let k = 0; k < xcount.length; k++) {
                xcount[k] = xcount[k] * 300
            }

            const obj = xcount
            let yInd = -1
            const data = Object.entries(obj).map(element => {
                yInd = yInd + 1
                return {
                    Country: yname[yInd],
                    Value: element[1]
                }
            });

            // Scales
            const x = d3.scaleBand()
                .range([0, 2 * Math.PI])    // X axis goes from 0 to 2pi = all around the circle. If I stop at 1Pi, it will be around a half circle
                .align(0)                  // This does nothing
                .domain(data.map(d => d.Country)); // The domain of the X axis is the list of states.
            const y = d3.scaleRadial()
                .range([innerRadius, outerRadius])   // Domain will be define later.
                .domain([0, 14000]); // Domain of Y is from 0 to the max seen in the data

            // Add the bars
            svg.append("g")
                .selectAll("path")
                .data(data)
                .join("path")
                .attr("fill", "#69b3a2")
                .attr("d", d3.arc()     // imagine your doing a part of a donut plot
                    .innerRadius(innerRadius)
                    .outerRadius(d => y(d['Value']))
                    .startAngle(d => x(d.Country))
                    .endAngle(d => x(d.Country) + x.bandwidth())
                    .padAngle(0.01)
                    .padRadius(innerRadius))

            // Add the labels
            svg.append("g")
                .selectAll("g")
                .data(data)
                .join("g")
                .attr("text-anchor", function(d) { return (x(d.Country) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "end" : "start"; })
                .attr("transform", function(d) { return "rotate(" + ((x(d.Country) + x.bandwidth() / 2) * 180 / Math.PI - 90) + ")"+"translate(" + (y(d['Value'])+10) + ",0)"; })
                .append("text")
                .text(function(d){return(d.Country)})
                .attr("transform", function(d) { return (x(d.Country) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "rotate(180)" : "rotate(0)"; })
                .style("font-size", "11px")
                .attr("alignment-baseline", "middle")

    }

    document.getElementById("showToday").onclick = () => {
        slider.value = uniqueDates.length - 1
        console.log(slider.value)
        displayed_date.innerHTML = "Today's Date: " + uniqueDates[slider.value];
        console.log("Showing Today");
        changeDate()
        reset()

    }

    document.getElementById("my_dataviz_exit").onclick = () => {
        document.getElementById("my_dataviz_container").style.display = "none";

    }

}
