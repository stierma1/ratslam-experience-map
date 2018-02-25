var ExperienceMap = require("../lib/experience-map");
var chai = require("chai");
var expect = chai.expect;
var drawBitmap = require("../lib/draw-bitmap");
var draw = function(exps){
  var s = "";
  for(var i = -5; i < 5; i++){
    for(var j = -5; j< 5; j++){
      var sym = "-";
      for(var k in exps){
        if(Math.abs(exps[k].x_m - i) < .5 && Math.abs(exps[k].y_m - j)< .5){
          sym = exps[k].id
        }
      }
      s += sym;
    }
    s+= "\n";
  }

  console.log(s)
}

describe("Experience Map", function(){
  var expMap = null;

  beforeEach(function(){
    expMap = new ExperienceMap();
  })

  afterEach(function(){
    expMap = null;
  })

  it("should construct with config values", function(){
    expMap = new ExperienceMap({exp_correction:1, exp_loops:11, max_goals:11})
    expect(expMap).to.have.property("EXP_CORRECTION").equals(1);
    expect(expMap).to.have.property("EXP_LOOPS").equals(11);
    expect(expMap).to.have.property("MAX_GOALS").equals(11);
    expect(expMap).to.have.property("accum_delta_facing").equals(Math.PI/2);
  })

  it("should construct with default values", function(){
    expect(expMap).to.have.property("EXP_CORRECTION").equals(.5);
    expect(expMap).to.have.property("EXP_LOOPS").equals(10);
    expect(expMap).to.have.property("MAX_GOALS").equals(10);
    expect(expMap).to.have.property("accum_delta_facing").equals(Math.PI/2);
  })

  it("should add one experience and have no links", function(){
    expMap.create_experience(0,0,0,10);
    expect(expMap.experiences).to.have.property("length").equals(1);
    expect(expMap.links).to.have.property("length").equals(0);
  })

  it("should add two experience and have 1 link", function(){
    expMap.create_experience(0,0,0,10);
    expect(expMap.experiences).to.have.property("length").equals(1);
    expect(expMap.links).to.have.property("length").equals(0);
    expMap.current_exp_id = expMap.experiences[0].id;
    expMap.create_experience(1,1,1,20);
    expect(expMap.experiences).to.have.property("length").equals(2);
    expect(expMap.links).to.have.property("length").equals(1);
  })

  it("shoud accumulate deltas", function(){
    expMap.create_experience(0,0,0,10);
    expMap.current_exp_id = expMap.experiences[0].id;
    expMap.integrate_position(1, 0);
    expect(expMap).to.have.property("accum_delta_facing").equals(Math.PI/2)
    expect(expMap).to.have.property("accum_delta_x").equals(0)
    expect(expMap).to.have.property("accum_delta_y").equals(1)

    //reverse direction and move same amount
    expMap.integrate_position(1, Math.PI);
    expect(expMap).to.have.property("accum_delta_facing").equals(-Math.PI/2)
    expect(expMap).to.have.property("accum_delta_x").equals(0)
    expect(expMap).to.have.property("accum_delta_y").equals(0)

    expMap.integrate_position(1, Math.PI/2);
    expect(expMap).to.have.property("accum_delta_facing").equals(0)
    expect(expMap).to.have.property("accum_delta_x").equals(1)
    expect(expMap).to.have.property("accum_delta_y").equals(0)


    expMap.integrate_position(1, 0);
    expect(expMap).to.have.property("accum_delta_facing").equals(0)
    expect(expMap).to.have.property("accum_delta_x").equals(2)
    expect(expMap).to.have.property("accum_delta_y").equals(0)
  })

  it("should create a loop", function(){
    var expMap = new ExperienceMap({exp_correction:.1})
    expMap.create_experience(1,1,Math.PI/2,10);
    expMap.set_current_id(expMap.experiences[0].id)
    expMap.integrate_position(2, 0);

    expMap.create_experience(1,3,Math.PI/2,5);
    expMap.set_current_id(expMap.experiences[1].id)
    expMap.integrate_position(2.0, 3*Math.PI/2 + .05);

    expMap.create_experience(3,3,0,7);
    expMap.set_current_id(expMap.experiences[2].id)
    expMap.integrate_position(1.7, -Math.PI/2);

    expMap.create_experience(3,1,-Math.PI/2, 7);
    expMap.set_current_id(expMap.experiences[3].id)
    expMap.integrate_position(2, -Math.PI/2);

    expMap.create_experience(1,1,-Math.PI, 7);
    expMap.set_current_id(expMap.experiences[4].id)
    expMap.create_link(4,0,1);
    expMap.set_current_id(expMap.experiences[0].id)
    //draw(expMap.experiences)
    drawBitmap(50,50, expMap, 16, "d1.bmp")

    expMap.iterate();
    //draw(expMap.experiences)
    drawBitmap(50,50, expMap, 16, "d2.bmp")

    expMap.iterate();
    //draw(expMap.experiences)
    drawBitmap(50,50, expMap, 16, "d3.bmp")

    expMap.iterate();
    //draw(expMap.experiences)
    //drawBitmap(50,50, expMap, 16, "d4.bmp")

    expMap.integrate_position(3, -Math.PI);
    expMap.create_experience(3,1, -Math.PI, 3);
    expMap.set_current_id(expMap.experiences[5].id)
    expMap.integrate_position(2, -Math.PI/2);
    expMap.create_experience(3,2, -Math.PI/2, 1);
    expMap.set_current_id(expMap.experiences[6].id)
    expMap.integrate_position(4, -Math.PI/2);
    expMap.create_experience(-1,2, 0, 6);
    expMap.set_current_id(expMap.experiences[7].id)
    expMap.create_link(7,1,1);
    expMap.set_current_id(expMap.experiences[1].id)
    drawBitmap(50,50, expMap, 16, "d4.bmp")
    expMap.iterate();
    drawBitmap(50,50, expMap, 16, "d5.bmp")
    expMap.iterate();
    //draw(expMap.experiences)


  })
})
