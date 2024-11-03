library(data.table)
library(ggplot2)
library(parallel)

source("header.R")

# Bootstrap function to calculate confidence intervals
bootstrap = function(data, n_bootstrap = 10000, conf_level = 0.95) {
  # Store bootstrap means
  bootstrap_means = vapply(seq_len(n_bootstrap), function(i) {
    # Sample with replacement
    set.seed(i)
    sample_data = data[sample(.N, replace = TRUE)]
    return(mean(sample_data[, minutes]))
  }, numeric(1L))
  
  # Calculate the confidence intervals
  lower_bound = quantile(bootstrap_means, (1 - conf_level) / 2)
  upper_bound = quantile(bootstrap_means, 1 - (1 - conf_level) / 2)
  
  return(c(lower_bound, upper_bound))
}

# Load in data
LAP.TIMES.DT = fread(data.dir("lap_times.csv"))
RACES.DT = fread(data.dir("races.csv"))
DRIVERS.DT = fread(data.dir("drivers.csv"))
RESULTS.DT = fread(data.dir("results.csv"))
CONSTRUCTORS.DT = fread(data.dir("constructors.csv"))

# Create a field for the driver names
DRIVERS.DT[, driver.name := sprintf("%s %s", forename, surname)]

# Merge the driver names onto the lap times
LAP.TIMES.DT[DRIVERS.DT, on = .(driverId), driver.name := i.driver.name]

# Merge the team names onto the lap times as well
LAP.TIMES.DT[RESULTS.DT, on = .(raceId, driverId), constructorId := i.constructorId]
LAP.TIMES.DT[CONSTRUCTORS.DT, on = .(constructorId), team.name := i.name]

# Merge the race name onto the lap times
LAP.TIMES.DT[RACES.DT, on = .(raceId), `:=`(race.name = i.name, race.date = i.date)]

# Calculate lap time in minutes
LAP.TIMES.DT[, minutes := milliseconds / 60e3]

# Average the lap times for a given driver, race combo
AVG.DT = LAP.TIMES.DT[, .(
  avg.lap.time = mean(minutes),
  sd.lap.time = sd(minutes),
  cnt = .N
), by = .(driver.name, team.name, race.name, race.date)]

# Loop through each driver and calculate CIs
n.combos = nrow(AVG.DT)
CIs = mclapply(seq_len(n.combos), function(i) {
  print(sprintf("Working on combination: %d/%d...", i, n.combos))
  DRIVER.DATA = LAP.TIMES.DT[
    driver.name == AVG.DT[i, driver.name] &
    team.name == AVG.DT[i, team.name] &
    race.name == AVG.DT[i, race.name] &
    race.date == AVG.DT[i, race.date]
  ]
  ci = bootstrap(DRIVER.DATA)
  return(ci)
}, mc.cores = detectCores() - 1L)
