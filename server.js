var lib_http = require("http");
var lib_fs = require("fs");
var lib_path = require("path");
var lib_websocket = require("websocket");
var lib_chalk = require("chalk");

var https = lib_http.createServer(function(request, response) {
  var filePath = "." + request.url;
  if (filePath === "./") {
    filePath = "./index.html";
  }

  var extname = lib_path.extname(filePath);
  var contentType = "text/html";
  switch (extname) {
    case ".js":
      contentType = "text/javascript";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
      contentType = "image/jpg";
      break;
    case ".wav":
      contentType = "audio/wav";
      break;
  }

  lib_fs.readFile(filePath, function(error, content) {
    if (error) {
      if (error.code === "ENOENT"){
        lib_fs.readFile("./404.html", function(error, content) {
          response.writeHead(404, { "Content-Type": contentType });
          response.end(content, "utf-8");
        });
      } else {
        response.writeHead(500);
        response.end("Sorry, check with the site admin for error: "+error.code+" ..\n");
        response.end();
      }
    } else {
      response.writeHead(200, { "Content-Type": contentType });
      response.end(content, "utf-8");
    }
  });
});
https.listen(8080);


var wss = new lib_websocket.server({
  httpServer: https, autoAcceptConnections: false
});

var clients = {};
var lastClientId = -1;
var cursorList = ["cursor-white.png", "cursor-red.png", "cursor-orange.png", "cursor-yellow.png", "cursor-blue.png", "cursor-cyan.png"];

function broadcast(msg) {
  for (var client in clients) {
    clients[client].conx.send(msg);
  }
}

wss.on("request", function(request) {
  /*if (!request.origin) {
    console.log(chalk.red.bold("Connection from origin " + request.origin + " rejected."));
    request.reject();
    return;
  } No need to reject connections JUST yet. */

  var conx = request.accept();

  var id = lastClientId + 1;
  lastClientId++;
  clients[id] = {conx: conx, cursor: cursorList[Math.floor(Math.random() * cursorList.length)], x: 0, y: 0};

  console.log(lib_chalk.green.bold("Peer " + conx.remoteAddress + " accepted."));

  conx.send(JSON.stringify({ action: "conxEstablish", id: id, cursor: clients[id].cursor }));

  conx.on("message", function(raw) {
    if (raw.type === "utf8") {
      console.log(lib_chalk.cyan("Received Message: " + raw.utf8Data));

      var message = JSON.parse(raw.utf8Data);
      switch (message.action) {
        case "move":
          clients[id].x = message.x;
          clients[id].y = message.y;
          broadcast(JSON.stringify({ action: "clientMove", cursor: clients[id].cursor, sender: id, x: message.x, y: message.y }));
          break;
      }

    } else if (raw.type === "binary") {
      console.log(lib_chalk.cyan("Received Binary Message of " + raw.binaryData.length + " bytes"));
    }
  });
  conx.on("close", function(reasonCode, description) {
    console.log(lib_chalk.red.bold("Peer " + conx.remoteAddress + " disconnected."));
    delete clients[id];
    broadcast(JSON.stringify({ action: "clientLeave", id: id}));
  });

});
