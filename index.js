let app = require("express")();
let http = require("http").Server(app);
let io = require("socket.io")(http);
const axios = require("axios");

let apiUrl = "";
var onlineMemberList = [];

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    io.emit("users-changed", { memberId: socket.memberId, event: "left" });
    var memberIndex = onlineMemberList.findIndex(
      (x) => x.memberId == socket.memberId
    );
    if (memberIndex > -1) {
      onlineMemberList.splice(memberIndex, 1);
    }
    console.log("Member Disconnected => ", socket.memberName);
    writeStatus();
  });

  socket.on("sendMessage", (data) => {
    var targetIsOnline = memberIsOnline(data.TargetId);
    if (targetIsOnline) {
      var targetMember = onlineMemberList.filter(
        (x) => x.memberId == data.TargetId
      )[0];
      console.log("Send Info", targetMember);
      data.Screen = targetMember.screen;
      if (targetMember.screen == "App") {
        io.to(targetMember.socketId).emit("notification", data);
        //send toast message
      } else if (targetMember.screen == "ConversationList") {
        //send toast
        io.to(targetMember.socketId).emit("notification", data);
      } else if (targetMember.screen != "MessageList-" + data.ConversationId) {
        //send toast
        io.to(targetMember.socketId).emit("notification", data);
      } else {
        socket.broadcast.to(data.ConversationId).emit("message", data);
      }
    } else {
      //send push notification
      sendNotification(data.SenderMemberId, data.TargetId, data.Token);
    }
    console.log("SendMessage => ", data);
    console.log("Target Status =>", targetIsOnline);
  });

  socket.on("subscribe", (conversationId) => {
    console.log("Joining Conversation => Id:", conversationId);
    socket.join(conversationId);
  });

  socket.on("changeScreen", (data) => {
    console.log("Screen Changed => Id:", data);
    var member = onlineMemberList.filter((x) => x.memberId == data.memberId);
    if (member.length > 0) {
      member[0].screen = data.screen;
    }
    writeStatus();
  });

  socket.on("joinClient", (joinClientInfo) => {
    console.log("joinClient => ", joinClientInfo);
    socket.memberId = joinClientInfo.MemberId;
    socket.memberName = joinClientInfo.Member;
    io.emit("users-changed", { user: joinClientInfo, event: "joined" });
    var client = {
      memberId: joinClientInfo.MemberId,
      member: joinClientInfo.Member,
      screen: "App",
      socketId: socket.id,
    };
    if (!memberIsOnline(client.memberId)) {
      onlineMemberList.push(client);
    }
    writeStatus();
  });
});

//Helper Functions
function writeStatus() {
  console.clear();
  console.log("Current Online Member Count : ", onlineMemberList.length);
  onlineMemberList.forEach((element) => {
    console.log(
      element.memberId +
        "|" +
        element.member +
        "|" +
        element.screen +
        "|" +
        element.socketId
    );
  });
}

function memberIsOnline(memberId) {
  return onlineMemberList.filter((x) => x.memberId == memberId).length > 0;
}

function sendNotification(senderMemberId, targetMemberId, token) {
  let model = {
    SenderMemberId: senderMemberId,
    TargetMemberId: targetMemberId,
  };
  var url = apiUrl + "/Conversation/SendPush";
  var config = {
    headers: { Authorization: "Bearer " + token },
  };
  axios
    .post(url, model, config)
    .then((response) => {
      console.log("PushNotification Send", response.data);
    })
    .catch((error) => {
      console.log("Push Notification Send Err", error);
    });
}

var port = process.env.PORT || 5361;

http.listen(port, "localhost", "", () => {
  console.log("Server started, listening in http://localhost:" + port);
});
