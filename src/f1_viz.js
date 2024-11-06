// Wait for the DOM to fully load before executing the script
document.addEventListener("DOMContentLoaded", function () {
    const typeSelect = d3.select("#type-select");
    const entitySelect = d3.select("#entity-select");
    let rawData = [];
    let chartData = [];
    let selectedEntityType = "";

    // Define color scale for chart lines
    const customColors = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
        "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#c49c94", "#f7b6d2", "#c7c7c7", "#dbdb8d", "#9edae5",
        "#393b79", "#5254a3", "#6b6ecf", "#9c9ede", "#637939", "#8ca252", "#b5cf6b", "#cedb9c", "#8c6d31", "#bd9e39",
        "#e7ba52", "#e7cb94", "#843c39", "#ad494a", "#d6616b", "#e7969c", "#7b4173", "#a55194", "#ce6dbd", "#de9ed6"
    ];
    const colorScale = d3.scaleOrdinal(customColors);

    // Chart dimensions and margins
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const width = 1300;
    const height = 4600;

    // Line generator function
    const lineGen = (data, horizScale, vertScale) => d3.line()
        .curve(d3.curveMonotoneX)
        .x(d => horizScale(d.raceYear))
        .y(d => vertScale(d.avgLapTime))
        (data);

    // Create the main SVG element for the chart
    const svg = d3.select("#chart")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto");

    // Enable crosshair cursor when hovering over plot
    svg.on("mouseout", () => svg.classed("cross-cursor", false));

    // Create the SVG element for the legend
    const legendSvg = d3.select("#legend");

    // Create tooltip for displaying data on hover
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    // Load and render data when the type selection changes
    d3.selectAll("#type-select").on("change", loadAndRenderData);

    /**
     * Load data based on selected entity type and render the chart.
     */
    function loadAndRenderData() {
        selectedEntityType = typeSelect.node().value.toLowerCase().replace(/s$/, "");
        const dataLink = `/data/f1_${selectedEntityType}_data.json`;

        d3.select(".entity-selection").select("label").text(`Select ${capitalizeFirstLetter(selectedEntityType)}(s):`);

        // Fetch data from the server
        d3.json(dataLink)
            .then(data => {
                rawData = data;
                populateEntitySelect(rawData);
                updateChart();
            })
            .catch(error => {
                console.error("Error loading data:", error);
            });
    }

    /**
     * Populate the entity selection dropdown with unique entities from the data.
     * @param {Array} argData - The raw data containing entity information.
     */
    function populateEntitySelect(argData) {
        entitySelect.html(""); // Clear existing options
        const uniqueEntities = [...new Set(argData.map(d => d[selectedEntityType]))];

        // Create checkbox options for each unique asset
        uniqueEntities.forEach(entity => {
            const entityOption = entitySelect.append("div").attr("class", "entity");
            const idLabel = `${selectedEntityType}-${cleanEntityString(entity)}`;

            // Create checkbox option for each unique entity
            entityOption.append("input")
            .attr("type", "checkbox")
            .attr("id", idLabel)
            .attr("value", entity)
            .on("change", function () {
                const selectedCount = entitySelect.selectAll("input:checked").size();

                // Prevent selection if more than 30 checkboxes are selected
                if (selectedCount > customColors.length) {
                    alert(`You can only select up to ${customColors.length} entities.`);
                    this.checked = false; // Uncheck the current box
                } else {
                    updateChart(); // Proceed with updating the chart if the selection is valid
                }
            });

            entityOption.append("label")
                .attr("for", idLabel)
                .text(entity);
        });
    }

    /**
     * Update the chart based on the selected entities.
     */
    function updateChart() {
        const selectedEntities = Array.from(
            document.querySelectorAll("#entity-select input[type='checkbox']:checked")
        ).map(checkbox => checkbox.value);

        if (selectedEntities.length === 0) {
            console.warn(`No ${selectedEntityType}(s) selected.`);
            clearPlot();
            clearLegend();
            return;
        }

        // Filter raw data based on selected entities
        const filteredData = rawData.filter(d => selectedEntities.includes(d[selectedEntityType]));

        // Group data by race name
        const groupedRaceData = Array.from(d3.group(filteredData, d => d.race_name), ([race, values]) => ({ race, values }));

        // Aggregate data based on the selected entities
        chartData = aggregateData(groupedRaceData, selectedEntities);

        if (chartData.length === 0) {
            console.warn(`No data available for the selected ${selectedEntityType}(s).`);
            clearPlot();
            clearLegend();
            return;
        }

        drawChart(groupedRaceData, selectedEntities);
    }

    /**
     * Clear existing plots.
     */
    function clearPlot() {
        svg.selectAll(".subplot").remove();
    }

    /**
     * Clear the legend of the chart.
     */
    function clearLegend() {
        legendSvg.selectAll("*").remove();
    }

    /**
    * Aggregate data based on the selected entities.
    * @param {Array} groupedRaceData - Array of race objects with race name and values.
    * @param {Array} selectedEntities - Array of selected entity names.
    * @returns {Object} Aggregated data by race and entity.
    */
    function aggregateData(groupedRaceData, selectedEntities) {
        const aggregatedData = {};

        groupedRaceData.forEach(race => {
            const raceName = race.race;
            aggregatedData[raceName] = {};

            selectedEntities.forEach(entity => {
                const entityData = race.values.filter(d => d[selectedEntityType] == entity).map(d => ({
                    raceDate: new Date(d.race_date),
                    raceYear: Number(d.race_date.slice(0, 4)),
                    avgLapTime: d.avg_lap_time,
                    lowerLapTime: d.avg_lap_time - d.sd_lap_time,
                    upperLapTime: d.avg_lap_time + d.sd_lap_time,
                    minLapTime: d.min_lap_time,
                    maxLapTime: d.max_lap_time,
                    nLaps: d.n_laps
                }));

                if (entityData.length > 0) {
                    aggregatedData[raceName][entity] = entityData;
                }
            });
        });

        return aggregatedData;
    }


    /**
     * Draw the chart using the aggregated data.
     * @param {Array} races - Array of race objects with race name and values.
     */
    function drawChart(groupedRaceData, selectedEntities) {
        const nCols = 2;
        const subplotWidth = 625;
        const subplotHeight = 300;
        const subplotGapping = 50;
        colorScale.domain(selectedEntities);

        clearPlot();

        groupedRaceData.forEach((race, index) => {
            const raceName = race.race;
            const raceData = chartData[raceName];

            if (raceData.length === 0) {
                return;
            }

            const entitiesInRace = Object.keys(raceData);

            // Create a group for each subplot
            const subplot = svg.append("g")
                .attr("class", "subplot")
                .attr("transform", () => {
                    const colIdx = index % nCols;
                    const rowIdx = Math.floor(index / nCols);
                    return `translate(${margin.left + colIdx * subplotWidth}, ${margin.top + rowIdx * subplotHeight})`;
                })

            // Define scales for the subplot
            const raceYears = entitiesInRace.map(entity => raceData[entity].map(d => d.raceYear)).flat();
            const minYear = d3.min(raceYears) - 1;
            const maxYear = d3.max(raceYears) + 1;
            const xSubScale = d3.scaleLinear()
                .domain([minYear - 1, maxYear + 1])
                .range([0, subplotWidth - subplotGapping]);

            const ySubScale = d3.scaleLinear()
                .domain([
                    d3.min(entitiesInRace, entity => d3.min(raceData[entity], d => d.lowerLapTime)) * 0.9,
                    d3.max(entitiesInRace, entity => d3.max(raceData[entity], d => d.upperLapTime)) * 1.1
                ])
                .range([subplotHeight - subplotGapping, 0]);

            // Add x-axis to subplot
            if ((maxYear - minYear + 2) < 21) {
                subplot.append("g")
                    .attr("transform", `translate(0, ${subplotHeight - subplotGapping})`)
                    .call(d3.axisBottom(xSubScale).ticks(d3.tickStep(minYear - 1, maxYear + 1, 1)).tickFormat(d3.format(".0f")));
            } else {
                subplot.append("g")
                    .attr("transform", `translate(0, ${subplotHeight - subplotGapping})`)
                    .call(d3.axisBottom(xSubScale).ticks(d3.tickStep(minYear - 1, maxYear + 1, 2)).tickFormat(d3.format(".0f")));
            }

            // Add y-axis to subplot
            subplot.append("g")
                .call(d3.axisLeft(ySubScale));

            // Add title to subplot
            subplot.append("text")
                .attr("x", subplotWidth / 2)
                .attr("y", -10)
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .text(raceName);

            // Plot lines for each entity in the subplot
            entitiesInRace.forEach(entity => {
                const entityData = raceData[entity];

                if (entityData.length === 0) {
                    return;
                }

                const entityColor = colorScale(entity);
                const entityLine = lineGen(entityData, xSubScale, ySubScale);
                const entityCleaned = cleanEntityString(entity);

                // Draw whiskers
                subplot.selectAll(`.whisker-${entityCleaned}`)
                    .data(entityData)
                    .enter()
                    .append("line")
                    .attr("class", `whisker-${entityCleaned}`)
                    .attr("x1", d => xSubScale(d.raceYear))
                    .attr("x2", d => xSubScale(d.raceYear))
                    .attr("y1", d => ySubScale(d.lowerLapTime))
                    .attr("y2", d => ySubScale(d.upperLapTime))
                    .attr("stroke", entityColor)
                    .attr("stroke-width", 1);

                // Add horizontal bars at whisker ends (lower and upper)
                const barWidth = 5;
                subplot.selectAll(`.lower-bar-${entityCleaned}`)
                    .data(entityData)
                    .enter()
                    .append("line")
                    .attr("class", `lower-bar-${entityCleaned}`)
                    .attr("x1", d => xSubScale(d.raceYear) - barWidth / 2)
                    .attr("x2", d => xSubScale(d.raceYear) + barWidth / 2)
                    .attr("y1", d => ySubScale(d.lowerLapTime))
                    .attr("y2", d => ySubScale(d.lowerLapTime))
                    .attr("stroke", entityColor)
                    .attr("stroke-width", 1);

                subplot.selectAll(`.upper-bar-${entityCleaned}`)
                    .data(entityData)
                    .enter()
                    .append("line")
                    .attr("class", `upper-bar-${entityCleaned}`)
                    .attr("x1", d => xSubScale(d.raceYear) - barWidth / 2)
                    .attr("x2", d => xSubScale(d.raceYear) + barWidth / 2)
                    .attr("y1", d => ySubScale(d.upperLapTime))
                    .attr("y2", d => ySubScale(d.upperLapTime))
                    .attr("stroke", entityColor)
                    .attr("stroke-width", 1);

                // Draw the line for average lap time
                subplot.append("path")
                    .datum(entityData)
                    .attr("fill", "none")
                    .attr("stroke", entityColor)
                    .attr("stroke-width", 1.5)
                    .attr("d", entityLine);

                // Add data points
                // Draw circles for each data point
                subplot.selectAll(`.data-point-${entityCleaned}`)
                    .data(entityData)
                    .enter()
                    .append("circle")
                    .attr("class", `data-point-${entityCleaned}`)
                    .attr("cx", d => xSubScale(d.raceYear))
                    .attr("cy", d => ySubScale(d.avgLapTime))
                    .attr("r", 4)  // Radius of data point circles
                    .attr("fill", entityColor)
                    .on("mouseover", (event, d) => {
                        tooltip.style("display", "block")
                            .html(`
                            <strong>${entity}</strong><br>
                            Year: ${d.raceYear}<br>
                            Avg. Lap Time: ${d.avgLapTime.toFixed(3)}<br>
                            Std. Deviation: ${(d.avgLapTime - d.lowerLapTime).toFixed(3)}<br>
                            Fastest Lap: ${d.minLapTime.toFixed(3)}<br>
                            Slowest Lap: ${d.maxLapTime.toFixed(3)}<br>
                            # of Laps: ${d.nLaps}
                        `);
                        d3.select(event.target).attr("r", 6);  // Enlarge point on hover
                    })
                    .on("mousemove", (event) => {
                        tooltip.style("top", (event.pageY - 10) + "px")
                            .style("left", (event.pageX + 10) + "px");
                    })
                    .on("mouseout", (event) => {
                        tooltip.style("display", "none");
                        d3.select(event.target).attr("r", 4);  // Reset point size
                    });
            });
        });

        // Create a shared legend outside the subplots
        createLegend(selectedEntities);
    }

    /**
     * Create a legend for the chart.
     * @param {Array} selectedEntities - Array of selected entities.
     */
    function createLegend(selectedEntities) {
        clearLegend();

        selectedEntities.forEach((entity, index) => {
            const legendRow = legendSvg.append("g")
                .attr("transform", `translate(0, ${index * 20})`);

            legendRow.append("line")
                .attr("x1", 0)
                .attr("y1", 7)
                .attr("x2", 15)
                .attr("y2", 7)
                .attr("stroke", colorScale(entity))
                .attr("stroke-width", 3);

            legendRow.append("text")
                .attr("x", 20)
                .attr("y", 10)
                .text(entity)
                .attr("font-size", "12px")
                .attr("alignment-baseline", "middle");
        });
    }

    /**
     * Capitalize the first letter of a string.
     * @param {string} word - String to have the first letter capitalized.
     */
    function capitalizeFirstLetter(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }

    /**
     * Clean up the entity string for use in ids.
     * @param {string} str - The entity name.
     * @returns {string} Cleaned entity string.
     */
    function cleanEntityString(entity) {
        // Normalize the string to decompose accents and diacritics
        const normalized = entity.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Replace non-alphanumeric characters (except spaces, if needed) with hyphens
        return normalized.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
    }

    loadAndRenderData();
});