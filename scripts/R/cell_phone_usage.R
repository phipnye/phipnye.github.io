# Load the necessary libraries
library(data.table)
library(ggplot2)
library(stringr)

source("header.R")

save.plot = function(fp, plot, device = "svg", width = 14, height = 8, dpi = "retina") {
  library(svglite)
  ggsave(fp, plot = plot, device = device, width = width, height = height, dpi = dpi)
  return(invisible(NULL))
}

# Read in the raw data
DT = fread(data.dir("mobile_usage_behavioral_analysis.csv"))

# Update naming convention
setnames(DT, tolower(str_replace_all(names(DT), "_", ".")))

# Bin age groups
DT[, age.bin := cut(age, seq(18L, 60L, 6L), include.lowest = TRUE)]
stopifnot(!anyNA(DT[, age.bin]))

# Average hours across groupings
group.cols <- c("gender", "location", "age.bin")
hours.cols <- str_subset(names(DT), "hours$")
AVG.DT <- DT[, lapply(.SD, mean), by = group.cols, .SDcols = hours.cols]

# Reshape the hours columns down long
AVG.DT <- melt.data.table(
  AVG.DT,
  id.vars = group.cols,
  measure.vars = hours.cols,
  variable.name = "use.type",
  value.name = "use.hours"
)

# Reformat usage types
AVG.DT[, use.type := str_to_sentence(str_replace_all(use.type, "\\.", " "))]

# Sort the data
setorderv(AVG.DT, c(group.cols, "use.type"))

# Subset to Chicago, LA, and NYC
PLOT.DT <- AVG.DT[location %in% c("Chicago", "Los Angeles", "New York")]

# Enhanced bar chart plot
p <- ggplot(PLOT.DT, aes(x = age.bin, y = use.hours, fill = use.type)) +
  geom_bar(stat = "identity", position = position_dodge(width = 0.8), color = "black", width = 0.7) +
  facet_grid(gender ~ location) +
  labs(
    title = "Average Hourly App Usage by Gender, Age Group, and Location",
    x = "Age Group",
    y = "Average Hours",
    fill = "App Usage Type"
  ) +
  scale_y_continuous(
    limits = c(0, max(PLOT.DT[, use.hours])),
    expand = expansion(mult = c(0, 0.05)),
    breaks = scales::pretty_breaks(n = 5)
  ) +
  scale_fill_manual(
    values = c("Daily screen time hours" = "#4575b4",
               "Gaming app usage hours" = "#91bfdb",
               "Productivity app usage hours" = "#e0f3f8",
               "Social media usage hours" = "#fee090",
               "Total app usage hours" = "#fc8d59")
  ) +
  theme_bw(base_size = 14) +
  theme(
    plot.title = element_text(size = 18, face = "bold", hjust = 0.5, color = "#333333"),
    axis.title = element_text(size = 14, face = "bold", color = "#555555"),
    axis.text.x = element_text(angle = 45, hjust = 1, size = 10, color = "#444444"),
    axis.text.y = element_text(size = 10, color = "#444444"),
    strip.text = element_text(face = "bold", size = 12, color = "#333333"),
    panel.grid.major = element_line(color = "#eaeaea"),
    panel.grid.minor = element_blank(),
    legend.position = "top",
    legend.title = element_text(face = "bold"),
    legend.text = element_text(size = 10)
  )

# Save the plot
save.plot(img.dir("cell_phone_usage.svg"), plot = p)
