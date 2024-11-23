// Constants for chart dimensions and styling
const CHART_WIDTH = 1100;
const CHART_HEIGHT = 600;
const COUNTRY_COLOR = "#008080";
const COUNTRY_HOVER_COLOR = "#005f5f";
const COUNTRY_BORDER_COLOR = "#333";
const TOOLTIP_OFFSET_X = 10;
const TOOLTIP_OFFSET_Y = -30;
const ROTATE_SENSITIVITY = 0.25;

// Main function to initialize the globe visualization
function createGlobe() {
    // Create SVG container
    const svg = d3.select("#chart")
        .attr("viewBox", [0, 0, CHART_WIDTH, CHART_HEIGHT])
        .attr("width", CHART_WIDTH)
        .attr("height", CHART_HEIGHT);

    // Define projection and path generator
    const projection = d3.geoOrthographic()
        .scale(CHART_WIDTH / 2.2)
        .translate([CHART_WIDTH / 2, CHART_HEIGHT / 2])
        .clipAngle(90)
        .precision(0.1);

    const path = d3.geoPath().projection(projection);

    // Tooltip for displaying country data on hover
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip");

    // Load country statistics data and world map data
    Promise.all([
        d3.json("/data/countries_data.json"),
        d3.json("/data/countries-110m-upd.json")
    ]).then(([countryStats, worldData]) => {
        // Map country data by name for quick access
        const dataMap = Object.fromEntries(countryStats.map(d => [d.name, d]));
        const countries = topojson.feature(worldData, worldData.objects.countries).features;

        // Draw countries on the globe
        const countryPaths = svg.selectAll("path")
            .data(countries)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", COUNTRY_COLOR)
            .attr("stroke", COUNTRY_BORDER_COLOR)
            .attr("stroke-width", 0.5)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("fill", COUNTRY_HOVER_COLOR);
                showTooltip(event, d, dataMap);
            })
            .on("mousemove", function (event) {
                tooltip.style("left", `${event.pageX + TOOLTIP_OFFSET_X}px`)
                    .style("top", `${event.pageY + TOOLTIP_OFFSET_Y}px`);
            })
            .on("mouseout", function () {
                d3.select(this).attr("fill", COUNTRY_COLOR);
                tooltip.style("display", "none");
            });

        // Initialize drag behavior to rotate the globe
        initializeDrag(svg, projection, countryPaths);

        // Optional: Add graticule and sphere for visual enhancements
        addGlobeExtras(svg, path);

    }).catch(error => {
        console.error("Error loading data:", error);
    });

    // Display country information in tooltip
    function showTooltip(event, country, dataMap) {
        const countryName = country.properties.name || "Unknown";
        const countryData = dataMap[countryName] || {};
        
        // Define the fields to display in the tooltip
        const fields = [
            { key: 'population', label: 'Population'},
            { key: 'surface_area', label: 'Surface Area (km\u00B2)' },
            { key: 'forested_area', label: 'Forested Area (%)' },
            { key: 'gdp', label: 'GDP (USD)'},
            { key: 'imports', label: 'Imports (USD)'},
            { key: 'exports', label: 'Exports (USD)'},
            { key: 'life_expectancy_male', label: 'Life Expectancy (Male)' },
            { key: 'life_expectancy_female', label: 'Life Expectancy (Female)' },
            { key: 'homicide_rate', label: 'Homicide Rate (per 100k)' },
            { key: 'unemployment', label: 'Unemployment (%)' },
            { key: 'internet_users', label: 'Internet Users (%)' }
        ];

        let tooltipContent = `<strong>${countryName}</strong><br>`;
        fields.forEach(field => {
            let value = countryData[field.key];
            if (typeof value === 'number') {
                if (field.key === 'population' || field.key == 'refugees') {
                    value = d3.format(',')(value * 1000);
                }
                else if (field.key === 'gdp' || field.key === 'imports' || field.key === 'exports') {
                    value = d3.format('$,')(value * 1000);
                } else if (field.key === 'life_expectancy_male' || field.key === 'life_expectancy_female') {
                    value = value + ' years';
                } else {
                    value = value.toLocaleString();
                }
            }
            if (value === null || value === undefined) {
                value = 'N/A';
            }
            tooltipContent += `${field.label}: ${value}<br>`;
        });

        tooltip.style("display", "block")
            .html(tooltipContent)
            .style("left", `${event.pageX + TOOLTIP_OFFSET_X}px`)
            .style("top", `${event.pageY + TOOLTIP_OFFSET_Y}px`);
    }
}

// Initialize drag behavior to rotate the globe
function initializeDrag(svg, projection, countryPaths) {
    let initialRotation;

    svg.call(d3.drag()
        .on("start", event => {
            initialRotation = projection.rotate();
            event.subject = { x: event.x, y: event.y };
        })
        .on("drag", event => {
            const dx = event.x - event.subject.x;
            const dy = event.y - event.subject.y;
            const newRotation = [
                initialRotation[0] + dx * ROTATE_SENSITIVITY,
                initialRotation[1] - dy * ROTATE_SENSITIVITY
            ];
            projection.rotate(newRotation);
            countryPaths.attr("d", d3.geoPath().projection(projection));
        })
    );
}

// Adds optional visual elements: graticule and globe outline
function addGlobeExtras(svg, path) {
    const graticule = d3.geoGraticule();
    svg.append("path")
        .datum(graticule)
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 0.5);

    svg.append("path")
        .datum({ type: "Sphere" })
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
}

// Run the main function
createGlobe();
