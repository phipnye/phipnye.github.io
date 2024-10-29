// Load the stock data (assuming 'stocks_data.json' is your JSON file)
d3.json('stocks_data.json').then(data => {
    const svg = d3.select('svg');
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const width = svg.attr('width') - margin.left - margin.right;
    const height = svg.attr('height') - margin.top - margin.bottom;
  
    const chartArea = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
  
    const xScale = d3.scaleTime().range([0, width]);
    const yScale = d3.scaleLinear().range([height, 0]);
  
    const xAxis = chartArea.append('g').attr('transform', `translate(0, ${height})`);
    const yAxis = chartArea.append('g');
  
    // Populate stock dropdown
    const stockSelect = d3.select('#stock-select');
    const uniqueTickers = [...new Set(data.map(d => d.ticker))];
    uniqueTickers.forEach(ticker => {
      stockSelect.append('option').attr('value', ticker).text(ticker);
    });
  
    // Update chart on selection change
    d3.selectAll('#stock-select, #metric-select, #timeframe-select')
      .on('change', updateChart);
  
    function updateChart() {
      const selectedStocks = Array.from(stockSelect.node().selectedOptions)
                                  .map(option => option.value);
      const selectedMetric = d3.select('#metric-select').node().value;
      const selectedTimeframe = d3.select('#timeframe-select').node().value;
  
      const filteredData = data.filter(d => selectedStocks.includes(d.ticker));
  
      const aggregatedData = aggregateData(filteredData, selectedTimeframe);
      drawChart(aggregatedData, selectedMetric);
    }
  
    function aggregateData(data, timeframe) {
      // Group by ticker and date (based on selected timeframe)
      return d3.groups(data, d => d.ticker).flatMap(([ticker, stockData]) => {
        const dateParser = d3.timeParse('%Y-%m-%d');
        const timeFormat = d3.timeFormat(
          timeframe === 'weekly' ? '%Y-%U' : timeframe === 'monthly' ? '%Y-%m' : '%Y-%m-%d'
        );
  
        const grouped = d3.rollup(stockData, values => ({
          ticker: ticker,
          price: d3.mean(values, v => v.Price),
          volume: d3.mean(values, v => v.Volume),
          return: d3.mean(values, v => v.Return),
          date: timeFormat(dateParser(values[0].Date))
        }), d => timeFormat(dateParser(d.Date)));
  
        return Array.from(grouped.values());
      });
    }
  
    function drawChart(data, metric) {
      xScale.domain(d3.extent(data, d => new Date(d.date)));
      yScale.domain([0, d3.max(data, d => d[metric.toLowerCase()])]);
  
      const line = d3.line()
        .x(d => xScale(new Date(d.date)))
        .y(d => yScale(d[metric.toLowerCase()]));
  
      chartArea.selectAll('path').remove();
  
      chartArea.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);
  
      xAxis.call(d3.axisBottom(xScale));
      yAxis.call(d3.axisLeft(yScale));
    }
  
    // Initial chart render
    updateChart();
  });
  