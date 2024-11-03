# Point to the data directory
data.dir = function(fp) {
  dir = dirname(dirname(getwd()))
  return(file.path(dir, "data", fp))
}

# Point to the img directory
img.dir = function(fp) {
  dir = dirname(dirname(getwd()))
  return(file.path(dir, "img", fp))
}