var gri = require("./gri");
var Heap = require("heap");

var compare = {
    operator: function(exp1, exp2) {
        return exp1.time_from_current_s - exp2.time_from_current_s;
    }
};

function exp_euclidean_m(exp1, exp2) {
    return Math.sqrt((exp1.x_m - exp2.x_m) * (exp1.x_m - exp2.x_m) + (exp1.y_m - exp2.y_m) * (exp1.y_m - exp2.y_m));
}


class Experience_Map {
    constructor(config) {
      config = config || {};
        this.experiences = [];
        this.links = [];
        this.EXP_CORRECTION = config.exp_correction || .5;
        this.EXP_LOOPS = config.exp_loops || 10;
        this.MAX_GOALS = config.max_goals || 10;
        this.NEAR_ZERO = .000000001;

        this.current_exp_id = 0;
        this.prev_exp_id = 0;
        this.waypoint_exp_id = -1;

        this.goal_path_final_exp_id = -1;
        this.goal_timeout_s = 0;
        this.goal_success = false;

        this.accum_delta_facing = Math.PI / 2.0;
        this.accum_delta_x = 0;
        this.accum_delta_y = 0;

        this.kidnapped = 0;
    }

    destroy() {
        this.experiences = [];
        this.links = [];
    }

    // create a new experience for a given position
    create_experience(x, y, th, delta_time_s) {
        if (this.experiences.length === 0) {
            var new_exp = {
                id: 0,
                x_m: 0,
                y_m: 0,
                th_rad: 0,
                x_pc: x,
                y_pc: y,
                th_pc: th,
                dock_visible: false,
                goal_to_current: -1,
                current_to_goal: -1,
                links_from:[],
                links_to:[],
                vt_id:-1
            }
        } else {
            var new_exp = {
                id: this.experiences.length,
                x_m: this.experiences[this.current_exp_id].x_m + this.accum_delta_x,
                y_m: this.experiences[this.current_exp_id].y_m + this.accum_delta_y,
                th_rad: gri.clip_rad_180(this.accum_delta_facing),
                x_pc: x,
                y_pc: y,
                th_pc: th,
                dock_visible: false,
                goal_to_current: -1,
                current_to_goal: -1,
                links_from:[],
                links_to:[],
                vt_id:-1
            }
        }
        this.experiences.push(new_exp);

        if (this.experiences.length > 1) {
            this.create_link(this.current_exp_id, this.experiences.length - 1, delta_time_s);
        }

        return this.experiences.length - 1;
    }

    // update the current position of the experience map
    // since the last experience
    integrate_position(vtrans, vrot) {
        this.accum_delta_facing = gri.clip_rad_180(this.accum_delta_facing + vrot);
        if(!(Math.abs(vtrans * Math.cos(this.accum_delta_facing)) < this.NEAR_ZERO)){
          this.accum_delta_x = this.accum_delta_x + vtrans * Math.cos(this.accum_delta_facing)
        }
        if(!(Math.abs(vtrans * Math.sin(this.accum_delta_facing)) < this.NEAR_ZERO)){
          this.accum_delta_y = this.accum_delta_y + vtrans * Math.sin(this.accum_delta_facing);
        }

    }

    // iterate the experience map. Perform a graph relaxing algorithm to allow
    // the map to partially converge.
    iterate() {
        var i;
        var link_id;
        var exp_id;
        var link_from, link_to;
        var link;
        var lx, ly, df;


        for (i = 0; i < this.EXP_LOOPS; i++) {
            for (exp_id = 0; exp_id < this.experiences.length; exp_id++) {
                link_from = this.experiences[exp_id];

                for (link_id = 0; link_id < link_from.links_from.length; link_id++) {
                    //%             //% experience 0 has a link to experience 1
                    link = this.links[link_from.links_from[link_id]];
                    link_to = this.experiences[link.exp_to_id];

                    //%             //% work out where e0 thinks e1 (x,y) should be based on the stored
                    //%             //% link information
                    lx = link_from.x_m + link.d * Math.cos(link_from.th_rad + link.heading_rad);
                    ly = link_from.y_m + link.d * Math.sin(link_from.th_rad + link.heading_rad);

                    //%             //% correct e0 and e1 (x,y) by equal but opposite amounts
                    //%             //% a 0.5 correction parameter means that e0 and e1 will be fully
                    //%             //% corrected based on e0's link information
                    link_from.x_m += (link_to.x_m - lx) * this.EXP_CORRECTION;
                    link_from.y_m += (link_to.y_m - ly) * this.EXP_CORRECTION;
                    link_to.x_m -= (link_to.x_m - lx) * this.EXP_CORRECTION;
                    link_to.y_m -= (link_to.y_m - ly) * this.EXP_CORRECTION;

                    //%             //% determine the angle between where e0 thinks e1's facing
                    //%             //% should be based on the link information
                    df = gri.get_signed_delta_rad(link_from.th_rad + link.facing_rad, link_to.th_rad);

                    //%             //% correct e0 and e1 facing by equal but opposite amounts
                    //%             //% a 0.5 correction parameter means that e0 and e1 will be fully
                    //%             //% corrected based on e0's link information
                    link_from.th_rad = gri.clip_rad_180(link_from.th_rad + df * this.EXP_CORRECTION);
                    link_to.th_rad = gri.clip_rad_180(link_to.th_rad - df * this.EXP_CORRECTION);
                }
            }
        }

        return true;
    }

    // create a link between two experiences
    create_link(exp_id_from, exp_id_to, delta_time_s) {
        if (this.kidnapped === 1)
            return false;

        var current_exp = this.experiences[exp_id_from];

        // check if the link already exists
        for (var i = 0; i < this.experiences[exp_id_from].links_from.length; i++) {
            if (this.links[this.experiences[this.current_exp_id].links_from[i]].exp_to_id === exp_id_to)
                return false;
        }

        var new_link = {
            exp_to_id: exp_id_to,
            exp_from_id: exp_id_from,
            d: Math.sqrt(this.accum_delta_x * this.accum_delta_x + this.accum_delta_y * this.accum_delta_y),
            heading_rad: gri.get_signed_delta_rad(current_exp.th_rad, Math.atan2(this.accum_delta_y, this.accum_delta_x)),
            facing_rad: gri.get_signed_delta_rad(current_exp.th_rad, this.accum_delta_facing),
            delta_time_s: delta_time_s
        };

        this.links.push(new_link);

        // add this link to the 'to exp' so we can go backwards through the em
        this.experiences[exp_id_from].links_from.push(this.links.length - 1);
        this.experiences[exp_id_to].links_to.push(this.links.length - 1);

        return true;
    }

    // change the current experience
    set_current_id(new_exp_id) {
        // todo: check that this is a valid exp
        this.kidnapped = 0;

        if (new_exp_id == this.current_exp_id) {
            return 1;
        }

        this.prev_exp_id = this.current_exp_id;
        this.current_exp_id = new_exp_id;
        this.accum_delta_x = 0;
        this.accum_delta_y = 0;
        this.accum_delta_facing = this.experiences[this.current_exp_id].th_rad;

        return 1;
    }

    dijkstra_distance_between_experiences(id1, id2)
    {
    	var link_time_s;
    	var id;
      var exp_heap = new Heap(compare.operator);

    	for (id = 0; id < this.experiences.length; id++)
    	{
    		this.experiences[id].time_from_current_s = Number.MAX_VALUE;
    		exp_heap.push(this.experiences[id]);
    	}

    	this.experiences[id1].time_from_current_s = 0;
    	this.goal_path_final_exp_id = this.current_exp_id;

    	while (!exp_heap.empty())
    	{
        exp_heap.heapify();

    		var exp = exp_heap.peek();
    		if (exp.time_from_current_s === Number.MAX_VALUE)
    		{
    			return Number.MAX_VALUE;
    		}
    		exp_heap.pop();

    		for (id = 0; id < exp.links_to.length; id++)
    		{
    			var link = this.links[exp.links_to[id]];
    			link_time_s = exp.time_from_current_s + link.delta_time_s;
    			if (link_time_s < this.experiences[link.exp_from_id].time_from_current_s)
    			{
    				this.experiences[link.exp_from_id].time_from_current_s = link_time_s;
    				this.experiences[link.exp_from_id].goal_to_current = exp.id;
    			}
    		}

    		for (id = 0; id < exp.links_from.length; id++)
    		{
    			var link = this.links[exp.links_from[id]];
    			link_time_s = exp.time_from_current_s + link.delta_time_s;
    			if (link_time_s < this.experiences[link.exp_to_id].time_from_current_s)
    			{
    				this.experiences[link.exp_to_id].time_from_current_s = link_time_s;
    				this.experiences[link.exp_to_id].goal_to_current = exp.id;
    			}
    		}

    		if (exp.id == id2)
    		{
    			return exp.time_from_current_s;
    		}
    	}
    }
    // return true if path to goal found
    calculate_path_to_goal(time_s)
    {

    	var id;
    	this.waypoint_exp_id = -1;

    	if (this.goal_list.length === 0)
    		return false;

    	// check if we are within thres of the goal or timeout
    	if (exp_euclidean_m(this.experiences[this.current_exp_id], this.experiences[this.goal_list[0]]) < 0.1
    		 || ((this.goal_timeout_s !== 0) && time_s > this.goal_timeout_s))
    	{
    		if (this.goal_timeout_s !== 0 && time_s > this.goal_timeout_s)
    		{
    			console.log("Timed out reaching goal ... sigh");
    			this.goal_success = false;
    		}
    		if (exp_euclidean_m(this.experiences[this.current_exp_id], this.experiences[this.goal_list[0]]) < 0.1)
    		{
    			this.goal_success = true;
          console.log("Goal reached ... yay!" )
    		}
    		this.goal_list.shift();
    		this.goal_timeout_s = 0;

    		for (id = 0; id < this.experiences.length; id++)
    		{
    			this.experiences[id].time_from_current_s = Number.MAX_VALUE;
    		}
    	}

    	if (this.goal_list.size() == 0)
    		return false;

    	var profiler = gri.profile_exp_goal_path("exp goal path");
      profiler.start();
    	if (this.goal_timeout_s == 0)
    	{
    		var link_time_s;

        var exp_heap = new Heap(compare.operator);

    		for (id = 0; id < this.experiences.length; id++)
    		{
    			this.experiences[id].time_from_current_s = Number.MAX_VALUE;
    			exp_heap.push(this.experiences[id]);
    		}

    		this.experiences[current_exp_id].time_from_current_s = 0;
    		this.goal_path_final_exp_id = this.current_exp_id;

    		exp_heap.heapify();

    		while (!exp_heap.empty())
    		{
    			var exp = exp_heap.peek();
    			if (exp.time_from_current_s === Number.MAX_VALUE)
    			{
            console.log("Unable to find path to goal")
    				this.goal_list.shift();
            profiler.stop();
    				return false;
    			}
    			exp_heap.pop();

    			for (id = 0; id < exp.links_to.length; id++)
    			{
    				var link = this.links[exp.links_to[id]];
    				link_time_s = exp.time_from_current_s + link.delta_time_s;
    				if (link_time_s < this.experiences[link.exp_from_id].time_from_current_s)
    				{
    					this.experiences[link.exp_from_id].time_from_current_s = link_time_s;
    					this.experiences[link.exp_from_id].goal_to_current = exp.id;
    				}
    			}

    			for (id = 0; id < exp.links_from.length; id++)
    			{
    				var link = this.links[exp.links_from[id]];
    				link_time_s = exp.time_from_current_s + link.delta_time_s;
    				if (link_time_s < this.experiences[link.exp_to_id].time_from_current_s)
    				{
    					this.experiences[link.exp_to_id].time_from_current_s = link_time_s;
    					this.experiences[link.exp_to_id].goal_to_current = exp.id;
    				}
    			}

    			if (!exp_heap.empty())
            exp_heap.heapify()
    		}

    		// now do the current to goal links
    		var trace_exp_id = this.goal_list[0];
    		while (trace_exp_id !== this.current_exp_id)
    		{
    			this.experiences[this.experiences[trace_exp_id].goal_to_current].current_to_goal = trace_exp_id;
    			trace_exp_id = this.experiences[trace_exp_id].goal_to_current;
    		}

    		// means we need a new time out
    		if (this.goal_timeout_s == 0)
    		{
    			this.goal_timeout_s = time_s + Math.min(20.0+this.experiences[this.goal_list[0]].time_from_current_s * 3.0, 1.0 * 60.0);
          console.log("Goal timeout in " + this.goal_timeout_s - time_s + "s")
    		}
    	}
    	profiler.stop();

    	return true;
    }

    get_goal_waypoint()
    {
    	if (this.goal_list.length == 0)
    		return false;

    	this.waypoint_exp_id = -1;

    	var dist;
    	var dist_total = 0;
    	var temp_id = 0;
    	var trace_exp_id = this.goal_list[0];
    	var robot_exp = this.experiences[this.current_exp_id];

    	while (trace_exp_id !== this.goal_path_final_exp_id)
    	{
    		dist = exp_euclidean_m(this.experiences[trace_exp_id], robot_exp);
    		this.waypoint_exp_id = this.experiences[trace_exp_id].id;
    		if (dist < 0.2)
    		{
    			break;
    		}
    		trace_exp_id = this.experiences[trace_exp_id].goal_to_current;
    	}

    	if (this.waypoint_exp_id == -1)
    		this.waypoint_exp_id = this.current_exp_id;

    	return true;
    }

    add_goal(x_m, y_m)
    {
    	var min_id = -1;
    	var min_dist = Number.MAX_VALUE;
    	var dist;

    	if (this.MAX_GOALS !== 0 && this.goal_list.length >= this.MAX_GOALS)
    		return;

    	for (var i=0; i < this.experiences.length; i++)
    	{
    		dist = Math.sqrt((this.experiences[i].x_m-x_m)*(this.experiences[i].x_m-x_m) + (this.experiences[i].y_m-y_m)*(this.experiences[i].y_m-y_m));
    		if (dist < min_dist)
    		{
    			min_id = i;
    			min_dist = dist;
    		}
    	}

    	if (min_dist < 0.1)
    		this.add_goal(min_id);

    //	cout << "add_goal " << x_m << " " << y_m << " experiences[min_id] " << experiences[min_id].x_m << " " << experiences[min_id].y_m << endl;
    }

    get_subgoal_m()
    {
    	return (this.waypoint_exp_id === -1 ? 0 : Math.sqrt( Math.pow((this.experiences[this.waypoint_exp_id].x_m - this.experiences[this.current_exp_id].x_m), 2) +
    				   Math.pow((this.experiences[this.waypoint_exp_id].y_m - this.experiences[this.current_exp_id].y_m), 2)));
    }

    get_subgoal_rad()
    {
    //	if (waypoint_exp_id != -1)
    //		cout << "curr (" <<experiences[current_exp_id].x_m << "," << experiences[current_exp_id].y_m<< ") way (" << experiences[waypoint_exp_id].x_m<< "," <<experiences[waypoint_exp_id].y_m << ")" << endl;

    	if (this.waypoint_exp_id == -1)
    		return 0;
    	else
    	{
    		this.curr_goal_rad = Math.atan2((this.experiences[this.waypoint_exp_id].y_m - this.experiences[this.current_exp_id].y_m), (this.experiences[this.waypoint_exp_id].x_m - this.experiences[this.current_exp_id].x_m));
    		return (gri.get_signed_delta_rad(this.experiences[this.current_exp_id].th_rad, this.curr_goal_rad));
    	}
    }

    goto_dock()
    {
    	var docking_experiences = [];
    	if (this.goal_list.length === 0 || this.experiences[this.goal_list[0]].dock_visible === false)
    	{
    		this.goal_timeout_s = 0;
    		this.waypoint_exp_id = -1;
    		this.goal_list = [];
    		for (var id = 0; id < this.experiences.length; id++)
    		{
    			if (this.experiences[id].dock_visible)
    			{
    				docking_experiences.push(id);

    			}
    		}
    		if (docking_experiences.length > 0)
    		{
    			this.add_goal(docking_experiences[0]);
    		}
    	}

    }

}

module.exports = Experience_Map;
