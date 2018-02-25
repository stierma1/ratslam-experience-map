var bitmapManipulation = require("bitmap-manipulation");
var Bitmap = bitmapManipulation.BMPBitmap

var distance = function(p1, p2){
  var sum = 0;
  for(var i in p1){
    sum += (p1[i] - p2[i]) * (p1[i] - p2[i])
  }
  return Math.sqrt(sum);
}

function drawLine(p1, p2, inc){
  var currP = p1;
  var curdist = 0;
  var maxDist = distance(p1, p2);
  var pts = [];
  while(maxDist > curdist){
    var newPoint = [];
    var r = curdist / maxDist;
    if(r < .05){
      curdist++;
      continue;
    }
    for(var i in p1){
      newPoint.push(Math.ceil((p2[i] - p1[i]) * r + p1[i]));
    }
    pts.push(newPoint);
    //pts.push(newPoint.map((x) => {return x + 1}))
    curdist++;
  }

  return pts;
}

function drawCircle(x, y, size){
  var pointColl = [];
  for(var i = 1; i <= size; i++){
    var pt1 = [x - i, y - i];
    var pt2 = [x - i, y + i];
    var pt3 = [x + i, y + i];
    var pt4 = [x + i, y - i];
    pointColl = pointColl.concat(drawLine(pt1, pt2).concat(drawLine(pt2, pt3)).concat(drawLine(pt3, pt4)).concat(drawLine(pt4, pt1)))
  }

  return pointColl;
}

module.exports = function drawBitmap(x, y, experienceMap, scale, name, searchPoint){

  let bitmap = new bitmapManipulation.BMPBitmap(x * scale, y * scale);
  bitmap.drawFilledRect(0, 0, x * scale, y * scale, 0xffffff, 0xffffff)
  for(var i in experienceMap.links){
    var link = experienceMap.links[i];
    var v1 = experienceMap.experiences[link.exp_from_id];
    var v2 = experienceMap.experiences[link.exp_to_id];
    var v1_x = v1.x_m;
    var v1_y = v1.y_m;
    var v2_x = v2.x_m;
    var v2_y = v2.y_m;
    var circle = drawCircle((v1_x + x/2) * scale, (v1_y + y/2) * scale,2);
    for(var i in circle){
      bitmap.setPixel(circle[i][0] , circle[i][1] , 0xffff00)
    }
    var pts = drawLine([(v1_x + x/2) * scale, (v1_y + y/2) * scale], [(v2_x + x/2) * scale, (v2_y + y/2) * scale]);
    for(var i in pts){
      bitmap.setPixel(pts[i][0] , pts[i][1] , 0xffff00)
    }

  }
  if(searchPoint){
    var nextPts = rrt.findClosestPath(searchPoint);
    for(var i = 1; i < nextPts.length; i++){
      var fromPt = nextPts[i - 1];
      var toPt = nextPts[i];
      var pts = drawLine([(fromPt[0]+ x/2) * scale, (fromPt[1] + y/2) * scale], [(toPt[0] + x/2) * scale, (toPt[1] + y/2) * scale]);
      for(var j in pts){
        bitmap.setPixel(pts[j][0] , pts[j][1] , 0xffff70)
      }
    }
  }
  bitmap.save(name || "d.bmp");
}
