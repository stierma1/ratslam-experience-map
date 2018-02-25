
// % Clip the input angle to between 0 and 2pi radians
function clip_rad_360(angle)
{
    while (angle < 0)
        angle += 2.0 * Math.PI;

    while (angle >= 2.0 * Math.PI)
        angle -= 2.0 * Math.PI;

    return angle;
}

function clip_rad_180(angle)
{
    while (angle > Math.PI)
        angle -= 2.0 * Math.PI;

    while (angle <= -Math.PI)
        angle += 2.0 * Math.PI;

    return angle;
}

//% Get the signed delta angle from angle1 to angle2 handling the wrap from 2pi
//% to 0.
function get_signed_delta_rad( angle1,  angle2)
{
    var dir = clip_rad_180(angle2 - angle1);

    var delta_angle = clip_rad_360(angle1) - clip_rad_360(angle2);
	   delta_angle = Math.abs(delta_angle);

    if (delta_angle < 2.0 * Math.PI - delta_angle)
    {
        if (dir > 0)
            return delta_angle;
        else
            return -delta_angle;
    }
    else
    {
        if (dir > 0)
            return 2.0 * Math.PI - delta_angle;
        else
            return -(2.0 * Math.PI - delta_angle);
    }
}

var profiles = {};
class Profiler{
  constructor(name){
    this.name = name;
    this.startTime = Date.now();
    this.endTime = null;
    this.active = false;
    this.entries = [];
  }

  stop(){
    if(this.active){
      this.active = false;
      this.endTime = Date.now();
      this.entries.push([this.startTime, this.endTime]);
    }
  }

  start(){
    this.startTime = Date.now();
    this.active = true;
  }

  pause(){
    this.active = false
  }

  resume(){
    this.active = true;
  }

  elapsed(){
    var sum = 0;
    for(var i in this.entries){
      sum += (this.entries[i][1] - this.entries[i][0])
    }
    return sum;
  }
}

function profile_exp_goal_path(name ) {
  profiles[name] = new Profiler(name);
  return profiles[name];
}

module.exports.clip_rad_180 = clip_rad_180;
module.exports.clip_rad_360 = clip_rad_360;
module.exports.get_signed_delta_rad = get_signed_delta_rad;
module.exports.profile_exp_goal_path = profile_exp_goal_path;
