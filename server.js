var express=require("express"),
app=express(),
server=require("http").createServer(app),
io=require("socket.io").listen(server),
request = require("request");

server.listen(8080, '46.101.254.119');

function random(min,max){
	return Math.floor(Math.random()*(max-min+1)+min);
}//end of function

var speed = 200;
var sensitivity = 100;
var teleport_speed = speed;

var game_width = 2000;
var game_height = 2000;

var feed_interval = 300;
var trap_interval = 750;
var waiting_time = 15;

var basic_health = 300;
var basic_energy = 100;
var attack_range = 200;
var attack_damage = 300;
var energy_lose_after_attack = 200;
var energy_lose_after_makingSlow = 400;
var energy_consuming_forTeleport = 400;
var timeforNewFeeds = 15;
var maxhealth = 1000;
var maxenergy = 1000;
var roundStart = 0;
var last_end = Math.round( new Date().getTime() / 1000 );
var gameTime = 60 * 5;
var playerWaitingTime = 3;
var bot_players = new Array();
bot_players[0] = "3c7bd9a6cf7281a063e5c6fcab2cf379";
bot_players[1] = "47f221c9166044d93cf379e3a0ab6cfb";
bot_players[2] = "a33354620dd3eea1a6024f52c57bac16";
bot_players[3] = "04892263d740dd59b6b0d2f65b9f0d01";

var feeds = {};
var traps = {};
var players = {};
var feed_owners;
var game_is_ready = 0;
var ranking_players;
var player_number = 0;


function updateRankings(){
	ranking_players = {};
	var i = 0;
	for(var key in players){
		i++;
		var thiskills = players[key]["kills"];
		var thisorder = 0;
		for(var t in players){
			if(players[t]["kills"] > thiskills){
				thisorder++;
			}else if(players[t]["kills"] == thiskills && players[key]["deaths"] > players[t]["deaths"]){
				thisorder++;
			}else if(players[t]["kills"] == thiskills && players[key]['deaths'] == players[t]['deaths'] && players[key]['no'] < players[t]['no']){
				thisorder++;
			}
		}//finding order of this

		ranking_players[thisorder] = {};
		ranking_players[thisorder]["no"] = players[key]["no"];
		ranking_players[thisorder]["nickname"] = players[key]["nickname"];
		ranking_players[thisorder]["kills"] = thiskills;
		ranking_players[thisorder]["deaths"] = players[key]["deaths"];
	}//all players
}


setInterval(function(){
	if(game_is_ready == 1){
		updateRankings();
	}
}, 3000);

/* bots play */
setInterval(function(){
	if(game_is_ready == 1){
		feedsOfPlayers = {};
		for(var fi in feeds){
			for(var code in players){
				var dist = Math.sqrt( (players[code]["x"]-feeds[fi]["x"])*(players[code]["x"]-feeds[fi]["x"]) + (players[code]["y"]-feeds[fi]["y"])*(players[code]["y"]-feeds[fi]["y"]) );
				if(feedsOfPlayers[feeds[fi]["x"]+" "+feeds[fi]["y"]] == undefined){
					feedsOfPlayers[feeds[fi]["x"]+" "+feeds[fi]["y"]] = {"distance": dist, "player": code};
				}else if(feedsOfPlayers[feeds[fi]["x"]+" "+feeds[fi]["y"]]["distance"] > dist){
					feedsOfPlayers[feeds[fi]["x"]+" "+feeds[fi]["y"]] = {"distance": dist, "player": code};
				}//this distance < old distance
			}//all players
		}//all feeds
		
		feedsOfPlayers2 = {};
		for(var fi in feedsOfPlayers){
			pos = fi.split(" ");
			feedsOfPlayers2[feedsOfPlayers[fi]["player"]] = {"x": eval(pos[0]), "y": eval(pos[1])};
		}
		
		for(i = 0; i < bot_players.length; i++){
			if(players[bot_players[i]] != undefined){
				var player = players[bot_players[i]];
				if(player["dead"] == 1){
					play_again(bot_players[i], 1);
				}else{
					var players_around = 0;
					var action = "";
					var the_needed_energy = 1000;
					var left_theplayer;
					var top_theplayer;
					var dist_theplayer = 9999;
					
					for(var code in players){
						if(players[code]["dead"] == 0 && code != bot_players[i]){
							var distance = Math.sqrt( (player["x"]-players[code]["x"])*(player["x"]-players[code]["x"]) + (player["y"]-players[code]["y"])*(player["y"]-players[code]["y"]) );
							var needed_energy = Math.ceil(players[code]["health"]/(attack_damage*(attack_range-distance)/attack_range))*energy_lose_after_attack;
							var needed_distance_to_kill = attack_range-(energy_lose_after_attack*player["health"]*attack_range/attack_damage/player["energy"]);
							if(distance <= attack_range && needed_energy <= the_needed_energy && player["energy"] >= needed_energy){
									the_needed_energy = needed_energy;
									action = "attack";
									left_theplayer = players[code]["x"];
									top_theplayer = players[code]["y"];
									dist_theplayer = distance;
							}else if(action != "attack" && needed_distance_to_kill <= attack_range && needed_distance_to_kill > 10 && distance < dist_theplayer){
								action = "follow";
								left_theplayer = players[code]["x"];
								top_theplayer = players[code]["y"];
								dist_theplayer = distance;
							}else if(action != "attack" && action != "follow"){
								action = "eat";
							}//reaching is possible
						}//if player is alive
					}//all players
					
					if(action == "eat"){
						if(feedsOfPlayers2[code] != undefined){
							new_angle(bot_players[i], feedsOfPlayers2[code]["x"], feedsOfPlayers2[code]["y"]);
						}else{
							
						}
					}else if(action == "follow"){
						new_angle(bot_players[i], left_theplayer, top_theplayer);
					}else if(action == "attack"){
						new_angle(bot_players[i], left_theplayer, top_theplayer);
						attack(bot_players[i], left_theplayer, top_theplayer);
						attack(bot_players[i], left_theplayer, top_theplayer);
						attack(bot_players[i], left_theplayer, top_theplayer);
					}//action selection
				}//if bot is alive
			}//bot player exists
		}//loop of bot players
	}//if game is ready
},sensitivity);

function newgame(){
	var now = Math.round( new Date().getTime() / 1000 );
	last_end = now;
	game_is_ready = 0;
	updateRankings();
	for(var key in players){
		var query = "", ranking_query = "";
		if(player_number > 4){
			if(ranking_players[0]["nickname"] == players[key]["nickname"]){
				ranking_query = " ,first=first+1 ";
			}else if(ranking_players[1]["nickname"] == players[key]["nickname"]){
				ranking_query=" ,second=second+1 ";
			}else if(ranking_players[2]["nickname"] == players[key]["nickname"]){
				ranking_query=" ,third=third+1 ";
			}//checking first 3 players
		}//if player number > 4

		query="UPDATE players SET kills=kills+"+players[key]['kills']+",deaths=deaths+"+players[key]['deaths']+",rounds=rounds+1,lasttime='"+now+"'"+ranking_query+" WHERE code='"+key+"'";
/*

some deleted code due to security precautions

*/
	}//all players

	io.sockets.emit("end of the game", ranking_players);

	setTimeout(function(){
		feeds = {};
		traps = {};
		players = {};
		player_number = 0;
		for(l=0; l < Math.floor(game_width/trap_interval); l++){
		for(t=0; t < Math.floor(game_height/trap_interval); t++){

		if(random(1, 2) == 1){
		if(traps[l+" "+t] == undefined){
		var trap_left = l*trap_interval+random( Math.floor(trap_interval/6) , Math.floor(trap_interval/6*5) );
		var trap_top = t * trap_interval+random( Math.floor(trap_interval/6) , Math.floor(trap_interval/6*5) );

		traps[l+" "+t] = {};
		traps[l+" "+t]["x"] = trap_left;
		traps[l+" "+t]["y"] = trap_top;

		io.sockets.emit("new trap",{"x": trap_left, "y": trap_top});
		}//if there is not a trap in interval
		}//chance

		}//loop t
		}//loop l

		game_is_ready = 1;
		roundStart = Math.round( new Date().getTime()/1000 );
		io.sockets.emit("new game", {"roundStart": roundStart, "gameTime": gameTime});
		
		for(iii=0; iii < bot_players.length; iii++){
			player_join(bot_players[iii]);
		}//bot players join 
		
		setTimeout(function(){
			newgame();
		}, gameTime * 1000);
	
	}, waiting_time * 1000);

}//end of newgame

newgame();

function delete_old_players(){
/*

some deleted code due to security precautions

*/

	setTimeout(function(){
	delete_old_players();
	},  5 * 60 * 1000);
}//end of function

delete_old_players();

setInterval(function(){
if(game_is_ready == 1){
for(l = 0; l < Math.floor(game_width/feed_interval); l++){
for(t = 0; t < Math.floor(game_height/feed_interval); t++){

if(feeds[l+" "+t] == undefined){
	if(random(1, 3) != 1){
		var n = random(1, 16);
		if(n >= 1 && n <= 9){n = 1;}else if(n > 9 && n <= 12){n = 2;}else if(n > 12 && n <= 15){n = 3;}else if(n > 15){n = 4;}
		var feed_left = l*feed_interval+random( Math.floor(feed_interval/6) , Math.floor(feed_interval/6*5) );
		var feed_top = t*feed_interval+random( Math.floor(feed_interval/6) , Math.floor(feed_interval/6*5) );

		feeds[l+" "+t] = {};
		feeds[l+" "+t]["n"] = n;
		feeds[l+" "+t]["x"] = feed_left;
		feeds[l+" "+t]["y"] = feed_top;

		io.sockets.emit("new feed", {"x": feed_left, "y": feed_top, "n": n});
	}//if there is not a feed in interval
}//chance

}//loop t
}//loop l
}//if game is ready
}, timeforNewFeeds * 1000);

function play_again(code, wait){
	if(wait != 1){
		players[code]["x"] = random(0,game_width);
		players[code]["y"] = random(0,game_height);
		players[code]["slow_speed"] = 0;
		players[code]["health"] = basic_health;
		players[code]["energy"] = basic_energy;
		players[code]['dead'] = 0;
		io.sockets.emit("new player", players[code]);
	}else{
		setTimeout(function(){
			players[code]["x"] = random(0, game_width);
			players[code]["y"] = random(0, game_height);
			players[code]["slow_speed"] = 0;
			players[code]["health"] = basic_health;
			players[code]["energy"] = basic_energy;
			players[code]['dead'] = 0;
			io.sockets.emit("new player", players[code]);
		}, playerWaitingTime);
	}
}//end of function play again

function move(){
	for(var code in players){
		var cos_way = players[code]["cos"];
		var sin_way = players[code]["sin"];
		
		if(players[code]['dead'] == 0 && cos_way != ""){
			var now = Math.round( new Date().getTime() / 1000 );
			var charleft = players[code]["x"];
			var chartop = players[code]["y"];
			var player_speed = speed;

			if(players[code]["slow_speed"] > 0){player_speed = player_speed/2;players[code]["slow_speed"]--;}

			var lsi = Math.floor(charleft/trap_interval);
			var tsi = Math.floor(chartop/trap_interval);
			if(traps[lsi+" "+tsi] != undefined){
				var startx = charleft-80;var endx = charleft+80;
				var starty = chartop-70;var endy = chartop+70
				var trapl = traps[lsi+" "+tsi]["x"];
				var trapt = traps[lsi+" "+tsi]["y"];

				if(trapl > startx && trapl < endx && trapt > starty && trapt < endy){
					player_speed = Math.round(player_speed/4);
					if(players[code]["energy"] >= 10){
						players[code]["energy"] -= 10;
						io.sockets.emit("new energy", {"energy": players[code]['energy'], "no": players[code]['no']});
					}//energy lose
				}//trap borders control
			}//there may be a trap

			var difference_left = Math.floor( player_speed*cos_way*sensitivity/1000 );
			var difference_top = Math.floor( player_speed*sin_way*sensitivity/1000 );

			if( charleft+difference_left > 0 && charleft+difference_left < game_width){charleft += difference_left;}
			if( chartop+difference_top > 0 && chartop+difference_top < game_height ){chartop += difference_top;}
			players[code]["last_move"] = now;
			players[code]["x"] = charleft;
			players[code]["y"] = chartop;

			io.sockets.emit("new position", {"no": players[code]["no"], "charleft": charleft, "chartop": chartop, "angle": players[code]["angle"]});

			lsi = Math.floor(charleft/feed_interval);
			tsi = Math.floor(chartop/feed_interval);

			//var health=players[code]['health'];
			var energy = players[code]['energy'];
			if(energy < maxenergy){
				if(feeds[lsi+" "+tsi] != undefined){
					var startx = charleft-32;var endx = charleft+32;
					var starty = chartop-27;var endy = chartop+27;
					var feedl = feeds[lsi+" "+tsi]["x"];
					var feedt = feeds[lsi+" "+tsi]["y"];
					var feedn = feeds[lsi+" "+tsi]["n"];

					if(feedl > startx && feedl < endx && feedt > starty && feedt < endy){

						if(feedn == "1"){
							energy += 100;
						}else if(feedn == "2"){
							energy += 150;
						}else if(feedn == "3"){
							energy += 200;
						}else if(feedn == "4"){
							energy += 250;
						}//end of feedn

						//if(health>maxhealth){health=maxhealth;}
						if(energy > maxenergy){energy = maxenergy;}

						io.sockets.emit("new energy", {"energy": energy, "no": players[code]['no']});
						//io.sockets.emit("new health",{"no":players[data.code]['no'],"health":health});
						io.sockets.emit("delete feed",{"x": feedl, "y": feedt});
						delete feeds[lsi+" "+tsi];
						players[code]['energy'] = energy;
						//players[code]['health']=health;

					}//feed is under of fly
				}//there may be a feed
			}//if energy can be raised
			
		}//player is alive
	}//all players loop
}//end of function move

setInterval(function(){
	if(game_is_ready == 1){
		move();
	}
}, sensitivity);

function teleport(code, mouse_left, mouse_top){
	if(players[code]['energy'] > energy_consuming_forTeleport){
		var charleft = players[code]["x"];
		var chartop = players[code]["y"];
					
		var distance = Math.sqrt( (mouse_top-chartop)*(mouse_top-chartop) + (mouse_left-charleft)*(mouse_left-charleft) );
		var sin_way = (mouse_top-chartop) / distance;
		var cos_way = (mouse_left-charleft) / distance;

		var difference_top = Math.floor(teleport_speed*sin_way);
		var difference_left = Math.floor(teleport_speed*cos_way);

		if( charleft+difference_left > 0 && charleft+difference_left < game_width){charleft += difference_left;}
		if( chartop+difference_top > 0 && chartop+difference_top < game_height ){chartop += difference_top;}

		players[code]["x"] = charleft;
		players[code]["y"] = chartop;

		var angle = (-1)*Math.atan2(mouse_top - chartop, mouse_left - charleft) * 180 / Math.PI;
		if(angle < 0){angle += 360;}

		io.sockets.emit("new position", {"no": players[code]["no"], "charleft": charleft, "chartop": chartop, "angle": angle});
		if(players[code]["nickname"] != "admin"){
			players[code]["energy"] -= energy_consuming_forTeleport;
			io.sockets.emit("new energy", {"energy": players[code]['energy'], "no": players[code]['no']});
		}
	}//energy is enough
}//end of function teleport

function attack(code, mouse_left, mouse_top){
	if(players[code]['energy'] >= energy_lose_after_attack && players[code]['dead'] == 0){
		var charleft = players[code]["x"];
		var chartop = players[code]["y"];

		var startx = charleft-attack_range;
		var endx = charleft+attack_range;
		var starty = chartop-attack_range;
		var endy = chartop+attack_range;

		var mouse_distance = Math.sqrt( (mouse_left-charleft)*(mouse_left-charleft) + (mouse_top-chartop)*(mouse_top-chartop) );
		if(mouse_distance < attack_range){mouse_distance = attack_range;}
		var effectx = Math.floor( (charleft+ ((mouse_left-charleft)*(attack_range/mouse_distance)+charleft) )/2-attack_range/2 );
		var effecty = Math.floor( (chartop+ ((mouse_top-chartop)*(attack_range/mouse_distance)+chartop) )/2-1 );
		var attack_angle = (-1)*Math.atan2(mouse_top-chartop,mouse_left-charleft) * 180 / Math.PI;
		if(attack_angle < 0){attack_angle += 360;}
		io.sockets.emit("attack effect", {"effectx": effectx, "effecty": effecty, "attack_angle": attack_angle});

		for(var key in players){
			if(key != code && players[key]['dead'] == 0){
				var thisL = players[key]["x"];
				var thisT = players[key]["y"];
				if(thisL > startx && thisL < endx && thisT > starty && thisT < endy){
					var players_distance = Math.sqrt( (thisL-charleft)*(thisL-charleft) + (thisT-chartop)*(thisT-chartop) );
					if(players_distance <= attack_range){
						var thisAngle = (-1)*Math.atan2(thisT-chartop, thisL-charleft) * 180 / Math.PI;
						if(thisAngle < 0){thisAngle += 360;}

						var attackAngle = (-1)*Math.atan2(mouse_top - chartop, mouse_left - charleft) * 180 / Math.PI;
						if(attackAngle < 0){attackAngle += 360;}
						if( thisAngle > (attackAngle-30) && thisAngle < (attackAngle+30) ){
							players[key]["health"] -= attack_damage*(1-(players_distance/attack_range));
							if(players[key]["health"] <= 0){
								io.sockets.emit("death", {"killerno": players[code]['no'], "killernick": players[code]['nickname'], "killedno": players[key]['no'], "killednick": players[key]['nickname']});
								players[key]['dead'] = 1;
								players[key]["deaths"]++;
								players[code]["kills"]++;
								players[code]["health"] += 200;
								if(players[code]["health"] > maxhealth){players[code]["health"] = maxhealth;}
								io.sockets.emit("new health", {"no": players[code]['no'], "health": players[code]['health']});
							}else{
								io.sockets.emit("new health", {"no": players[key]['no'], "health": players[key]['health']});
							}//if player is alive after attack
						}//between angle
					}//if this player is on the attack range
				}//if this player is involved
			}//if not same player and alive
		}//players loop

		players[code]["energy"] -= energy_lose_after_attack;
		io.sockets.emit("new energy", {"energy": players[code]['energy'], "no": players[code]['no']});

	}//if energy is enough and attacker is alive
}//end of function attack

function new_angle(code, mouse_left, mouse_top){
	var charleft = players[code]["x"];
	var chartop = players[code]["y"];
		
	var distance = Math.sqrt( (mouse_top-chartop)*(mouse_top-chartop) + (mouse_left-charleft)*(mouse_left-charleft) );
	var sin_way = (mouse_top-chartop ) /distance;
	var cos_way = (mouse_left-charleft) / distance;

	var angle = (-1)*Math.atan2(mouse_top - chartop, mouse_left - charleft) * 180 / Math.PI;
	if(angle < 0){angle += 360;}
		
	players[code]["sin"] = sin_way;
	players[code]["cos"] = cos_way;
	players[code]["angle"] = angle;
}//end of function new angle

function player_join(code){
	if(game_is_ready == 1){
		if(players[code] == undefined){
/*

some deleted code due to security precautions

*/
		}//if player is not joined
	}//if game is ready
}//end of function

io.sockets.on("connection", function(socket){
	socket.send({"type": "game details", "width": game_width, "height": game_height, "attack_range": attack_range, "game_is_ready": game_is_ready, "roundStart": roundStart, "gameTime": gameTime});
	if(game_is_ready == 0){socket.send({"type": "score board", "ranking_players": ranking_players, "game_is_ready" :0});}
	
	socket.on("score board", function(data){
		socket.send({"type": "score board", "ranking_players": ranking_players, "game_is_ready": game_is_ready});
	});
	
	socket.on("teleport", function(data){
		if(game_is_ready == 1){
			if(players[data.code] != undefined){
				if(players[data.code]['dead'] == 0){
					teleport(data.code,data.mouse_left,data.mouse_top);
				}//player is alive
			}//player exists
		}//game is ready
	});

	socket.on("play again", function(data){
		if(players[data.code] != undefined){
			if(players[data.code]['dead'] == 1){
				play_again(data.code);
			}//if player is dead
		}//if player exists
	});

	socket.on("all feeds", function(asd){
		if(game_is_ready == 1){
			socket.send({"type": "all feeds", "data": feeds});
		}//game is ready
	});

	socket.on("attack", function(data){
		if(game_is_ready == 1){
			if(players[data.code] != undefined){
				attack(data.code, data.mouse_left, data.mouse_top);
			}//if player exists
		}//game is ready
	});

	socket.on("make_slow", function(data){
		if(game_is_ready == 1){
			if(players[data.code] != undefined){
				if(players[data.code]['energy'] >= energy_lose_after_makingSlow && players[data.code]['dead'] == 0){
					var mouse_left = data.mouse_left;
					var mouse_top = data.mouse_top;
					var charleft = players[data.code]["x"];
					var chartop = players[data.code]["y"];

					var startx = charleft-attack_range;
					var endx = charleft+attack_range;
					var starty = chartop-attack_range;
					var endy = chartop+attack_range;

					var mouse_distance = Math.sqrt( (mouse_left-charleft)*(mouse_left-charleft) + (mouse_top-chartop)*(mouse_top-chartop) );
					if(mouse_distance < attack_range){mouse_distance = attack_range;}
					var effectx = Math.floor( (charleft+ ((mouse_left-charleft)*(attack_range/mouse_distance)+charleft) )/2-attack_range/2 );
					var effecty = Math.floor( (chartop+ ((mouse_top-chartop)*(attack_range/mouse_distance)+chartop) )/2-1 );
					var attack_angle = (-1)*Math.atan2(mouse_top-chartop,mouse_left-charleft) * 180 / Math.PI;
					if(attack_angle < 0){attack_angle += 360;}
					io.sockets.emit("making_slow effect", {"effectx": effectx, "effecty": effecty, "attack_angle": attack_angle});

					for(var key in players){
						if(key != data.code && players[key]['dead'] == 0){
							var thisL = players[key]["x"];
							var thisT = players[key]["y"];
							if(thisL > startx && thisL < endx && thisT > starty && thisT < endy){
								var players_distance = Math.sqrt( (thisL-charleft)*(thisL-charleft) + (thisT-chartop)*(thisT-chartop) );
								if(players_distance <= attack_range){
									var thisAngle = (-1)*Math.atan2(thisT-chartop, thisL-charleft) * 180 / Math.PI;
									if(thisAngle < 0){thisAngle += 360;}

									var attackAngle = (-1)*Math.atan2(mouse_top - chartop, mouse_left - charleft) * 180 / Math.PI;
									if(attackAngle < 0){attackAngle += 360;}
									if( thisAngle > (attackAngle-30) && thisAngle < (attackAngle+30) ){
										players[key]["slow_speed"] = 20;
									}//between angle
								}//if this player is on the attack range
							}//if this player is involved
						}//if not same player and alive
					}//players loop

					players[data.code]["energy"] -= energy_lose_after_makingSlow;
					io.sockets.emit("new energy", {"energy": players[code]['energy'], "no": players[code]['no']});
				}//if energy is enough and attacker is alive
			}//if player exists
		}//game is ready
	});

	socket.on("all players", function(){
		if(game_is_ready == 1){
			var theplayers = {};
			for(var key in players){theplayers[players[key]['no']] = players[key];}
			socket.send({"type": "all players", "players": theplayers});
		}//if game is ready
	});

	socket.on("join", function(code){
		player_join(code);
	});

	socket.on("all traps", function(){
		if(game_is_ready == 1){
			socket.send({"type": "all traps", "traps": traps});
		}//game is ready
	});

	socket.on("new angle", function(data){
		if(players[data.code] != undefined){
			new_angle(data.code, data.mouse_left, data.mouse_top);
		}//if player exists
	});

});//connection