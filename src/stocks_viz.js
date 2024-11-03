// Wait for the DOM to fully load before executing the script
document.addEventListener("DOMContentLoaded", function () {
    // Select HTML elements
    const typeSelect = d3.select("#type-select");
    const assetSelect = d3.select("#asset-select");
    const metricSelect = d3.select("#metric-select");

    // Initialize data variables
    let rawData = [];
    let chartData = [];
    let selectedAssetType = "";

    // Define color scale for chart lines
    const customColors = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
        '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39',
        '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b', '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6'
    ];
    const colorScale = d3.scaleOrdinal(customColors);

    // Chart dimensions and margins
    const margin = { top: 20, right: 100, bottom: 50, left: 100 };
    const width = 1100;
    const height = 600;

    // Define scales for the axes
    const xScale = d3.scaleTime().range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);

    // Axis generators
    const xAxisGen = (g, x) => g.call(d3.axisBottom(x));
    const yAxisGen = (g, y) => g.call(d3.axisLeft(y));
    const yAxisGenReturns = (g, y) => g.call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

    // Line generator function
    const lineGen = (data, xScale) => d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.metric))
        (data);

    // Zoom behavior for the chart
    const zoom = d3.zoom()
        .scaleExtent([1, 64])
        .extent([[margin.left, 0], [width - margin.right, height]])
        .translateExtent([[margin.left, -Infinity], [width - margin.right, Infinity]])
        .on("zoom", zoomed);

    // Create the main SVG element for the chart
    const svg = d3.select("#chart")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto");

    // Enable crosshair cursor when hovering over plot
    svg.on("mouseout", () => {
        svg.classed("cross-cursor", false);
    });

    // Create the SVG element for the legend
    const legendSvg = d3.select("#legend");

    // Define a unique clipPath ID for the chart
    const clipID = "clip-1730324732682";

    // Append a clipPath to the SVG
    svg.append("clipPath")
        .attr("id", clipID)
        .append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom);

    // Append axes groups
    const xAxis = svg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`);
    const yAxis = svg.append("g").attr("transform", `translate(${margin.left}, 0)`);

    // Create tooltip for displaying data on hover
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    // Enable zoom functionality on the SVG
    svg.call(zoom);

    // Load and render data when the type or metric selection changes
    d3.selectAll("#type-select, #metric-select").on("change", loadAndRenderData);

    /**
     * Load data based on selected asset type and render the chart.
     */
    function loadAndRenderData() {
        selectedAssetType = typeSelect.node().value.toLowerCase().replace(/s$/, "");
        const dataLink = `/data/${selectedAssetType}s_data.json`;

        // Modify the width of the legend according to the selected asset type
        if (selectedAssetType === "sector") {
            d3.select("#legend").attr("width", 180).attr("height", 180);
            d3.select("#legend-container").attr("width", 210);
        } else {
            d3.select("#legend").attr("width", 70).attr("height", 600);
            d3.select("#legend-container").attr("width", 100);
        }

        // Fetch data from the server
        d3.json(dataLink)
            .then(data => {
                rawData = data;
                populateAssetSelect(rawData);
                updateChart();
            })
            .catch(error => {
                console.error("Error loading data:", error);
            });
    }

    /**
     * Populate the asset selection dropdown with unique assets from the data.
     * @param {Array} data - The raw data containing asset information.
     */
    function populateAssetSelect(data) {
        assetSelect.html(""); // Clear existing options
        const uniqueAssets = [...new Set(data.map(d => d[selectedAssetType]))];

        // Create checkbox options for each unique asset
        uniqueAssets.forEach(asset => {
            const assetOption = assetSelect.append("div").attr("class", "asset");

            assetOption.append("input")
                .attr("type", "checkbox")
                .attr("id", `${selectedAssetType}-${asset}`)
                .attr("value", asset)
                .on("change", updateChart);

            assetOption.append("label")
                .attr("for", `${selectedAssetType}-${asset}`)
                .text(asset);
        });
    }

    /**
     * Update the chart based on the selected assets and metrics.
     */
    function updateChart() {
        const selectedAssets = Array.from(
            document.querySelectorAll("#asset-select input[type='checkbox']:checked")
        ).map(checkbox => checkbox.value);

        if (selectedAssets.length === 0) {
            console.warn(`No ${selectedAssetType}s selected.`);
            clearLines();
            clearLegend();
            clearAxisLabels();
            return;
        }

        // Filter raw data based on selected assets
        const filteredData = rawData.filter(d => selectedAssets.includes(d[selectedAssetType]));
        chartData = aggregateData(filteredData);

        if (chartData.length === 0) {
            console.warn(`No data available for the selected ${selectedAssetType}(s).`);
            clearLines();
            clearLegend();
            clearAxisLabels();
            return;
        }

        drawChart();
    }

    /**
     * Clear existing lines from the chart.
     */
    function clearLines() {
        svg.selectAll(".line").remove();
        svg.selectAll(".hover-path").remove();
        xAxis.selectAll("*").remove();
        yAxis.selectAll("*").remove();
    }

    /**
     * Clear the legend of the chart.
     */
    function clearLegend() {
        legendSvg.selectAll("*").remove();
    }

    /**
     * Clear the axis labels from the chart.
     */
    function clearAxisLabels() {
        svg.selectAll(".x-axis-label").remove();
        svg.selectAll(".y-axis-label").remove();
    }

    /**
     * Aggregate data based on the selected metric.
     * @param {Array} argData - The filtered asset data.
     * @returns {Object} Aggregated data by asset.
     */
    function aggregateData(argData) {
        const selectedMetric = metricSelect.node().value.toLowerCase();
        const aggregatedData = {};

        argData.forEach(asset => {
            if (!aggregatedData[asset[selectedAssetType]]) {
                aggregatedData[asset[selectedAssetType]] = [];
            }
            asset.data.forEach(entry => {
                aggregatedData[asset[selectedAssetType]].push({
                    date: new Date(entry.date),
                    metric: entry[selectedMetric],
                });
            });
        });

        return aggregatedData;
    }

    /**
     * Draw the chart using the aggregated data.
     */
    function drawChart() {
        const assetSelections = Object.keys(chartData);
        colorScale.domain(assetSelections);
        const allData = assetSelections.flatMap(asset => chartData[asset]);
        xScale.domain(d3.extent(allData, d => d.date));
        yScale.domain(d3.extent(allData, d => d.metric));

        clearLines();
        clearLegend();
        clearAxisLabels();

        // Draw lines and legend for each selected asset
        assetSelections.forEach((asset, index) => {
            const assetData = chartData[asset];
            const line = lineGen(assetData, xScale);
            const lineColor = colorScale(asset);
            const attachData = { data: assetData, asset };

            // Create the line for the asset
            svg.append("path")
                .datum(attachData)
                .attr("class", "line")
                .attr("clip-path", `url(#${clipID})`)
                .attr("fill", "none")
                .attr("stroke", lineColor)
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Create a transparent hover path for interactivity
            svg.append("path")
                .datum(attachData)
                .attr("class", "hover-path")
                .attr("clip-path", `url(#${clipID})`)
                .attr("fill", "none")
                .attr("stroke", "transparent")
                .attr("stroke-width", 10)
                .attr("d", line)
                .on("mousemove", (event, d) => onHover(event, xScale, d))
                .on("mouseout", () => tooltip.style("display", "none"));

            // Append legend entry for the asset
            const legendRow = legendSvg.append("g")
                .attr("transform", `translate(0, ${20 * index})`);

            legendRow.append("line")
                .attr("x1", 0)
                .attr("y1", 7)
                .attr("x2", 15)
                .attr("y2", 7)
                .attr("stroke", lineColor)
                .attr("stroke-width", 3);

            legendRow.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .text(asset);
        });

        // Update dynamic axis labels
        const selectedMetric = metricSelect.node().value;
        xAxis.call(xAxisGen, xScale);

        if (selectedMetric === "Return") {
            yAxis.call(yAxisGenReturns, yScale);
        } else {
            yAxis.call(yAxisGen, yScale);
        }

        updateAxisLabels(selectedMetric);
    }

    /**
     * Update axis labels based on the selected metric.
     * @param {string} selectedMetric - The selected metric from the dropdown.
     */
    function updateAxisLabels(metric) {
        // Remove existing labels
        clearAxisLabels();

        // Add dynamic x-axis label
        svg.append("text")
            .attr("class", "x-axis-label")
            .attr("x", width / 2)
            .attr("y", height - margin.bottom / 2 + 10)
            .attr("text-anchor", "middle")
            .text("Date");

        // Determine y-axis label position based on the selected metric
        let yLabelYPosition;
        const yExtent = yScale.domain();

        if (yExtent[1] > 1e7) { // Large numbers (e.g., volume)
            yLabelYPosition = margin.left / 4 - 10;
        } else { // Smaller numbers (e.g., price, returns)
            yLabelYPosition = margin.left / 2 + 10;
        }

        // Add dynamic y-axis label
        svg.append("text")
            .attr("class", "y-axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", yLabelYPosition)
            .attr("text-anchor", "middle")
            .text(metric);
    }

    function zoomed(event) {
        // Rescale the x-axis based on the zoom transformation
        const xScaleNew = event.transform.rescaleX(xScale);

        // Gather visible data points within the new x-domain
        const visibleData = Object.keys(chartData).flatMap(asset => {
            const xDomain = xScaleNew.domain();
            return chartData[asset].filter(d => xDomain[0] <= d.date && d.date <= xDomain[1]);
        });

        // Update the y-scale based on visible data
        if (visibleData.length) {
            const yMin = d3.min(visibleData, d => d.metric);
            const yMax = d3.max(visibleData, d => d.metric);
            yScale.domain([yMin, yMax]);
        }

        // Clear existing lines from the chart
        clearLines();

        // Draw lines for each asset using the new x-scale
        const assets = Object.keys(chartData);
        assets.forEach(asset => {
            const assetData = chartData[asset];
            const line = lineGen(assetData, xScaleNew);
            const attachData = { data: assetData, asset };

            // Create the line for the asset
            svg.append("path")
                .datum(attachData)
                .attr("class", "line")
                .attr("clip-path", `url(#${clipID})`)
                .attr("fill", "none")
                .attr("stroke", colorScale(asset))
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Create a transparent hover path for interactivity
            svg.append("path")
                .datum(attachData)
                .attr("class", "hover-path")
                .attr("clip-path", `url(#${clipID})`)
                .attr("fill", "none")
                .attr("stroke", "transparent")
                .attr("stroke-width", 10)
                .attr("d", line)
                .on("mousemove", (event, d) => onHover(event, xScaleNew, d))
                .on("mouseout", () => tooltip.style("display", "none"));
        });

        // Update axes with the new scales
        xAxis.call(xAxisGen, xScaleNew);

        if (metricSelect.node().value === "Return") {
            yAxis.call(yAxisGenReturns, yScale);
        } else {
            yAxis.call(yAxisGen, yScale);
        }
    }


    /**
     * Handle mouse hover events on the chart.
     * @param {MouseEvent} event - The mouse event triggered.
     * @param {Object} scale - The horizontal axis scale corresponding to the current zoom level.
     * @param {Object} data - The data corresponding to the hovered asset.
     */
    function onHover(event, scale, d) {
        const selectedMetric = metricSelect.node().value;
        const { data: assetData, asset } = d;
        const [xPos] = d3.pointer(event, svg.node());
        const date = scale.invert(xPos);

        let closestData = null;
        let closestDistance = Infinity;

        // Find the closest data point in the asset data for the hovered line
        assetData.forEach(entry => {
            const distance = Math.abs(entry.date - date);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestData = entry;
            }
        });

        // Change cursor to crosshair when hovering
        svg.classed("cross-cursor", true);

        // Position tooltip and its content
        if (closestData) {
            const dateString = closestData.date.toISOString().slice(0, 10);
            const metricString = selectedMetric === "Price" ?
                `$${closestData.metric.toFixed(2)}` :
                selectedMetric === "Volume" ?
                    Intl.NumberFormat().format(closestData.metric) :
                    `${(closestData.metric * 100).toFixed(2)}%`;

            tooltip.style("display", "block")
                .html(`<strong>${capitalizeFirstLetter(selectedAssetType)}</strong>: ${asset}<br><strong>Date</strong>: ${dateString}<br><strong>${selectedMetric}</strong>: ${metricString}`)
                .style("left", (event.pageX + 20) + "px")
                .style("top", (event.pageY - 20) + "px");
        }
    }

    /**
     * Capitalize the first letter of a string.
     * @param {string} word - String to have the first letter capitalized.
     */
    function capitalizeFirstLetter(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }

    loadAndRenderData();
});