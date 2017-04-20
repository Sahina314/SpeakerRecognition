
var fs = require('fs');
var http = require('http');
const request = require('request');
var unirest = require('unirest');
var file;
var resp;
var profileid;

// Serve client side statically
var express = require('express');
var app = express();
app.set('port', (process.env.PORT || 9000));

app.use(express.static(__dirname + '/public'));
app.get('/users/:id', function(req, res) {
  res.send(req.params.id);
  unirest.post('https://westus.api.cognitive.microsoft.com/spid/v1.0/verificationProfiles')
    .headers({'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key' : '530fc76e57ff41ee8af9314c8a716166'})
    .send("{\"locale\":\"en-us\",}")
    .end(function (response) {
      console.log(response.body);
      resp=response.body;
      fs.readFile('./VerificationProfileid.json', 'utf-8', function(err, data) {
      if (err) throw err

      var arrayOfObjects = JSON.parse(data)
      arrayOfObjects.users.push({
        username: req.params.id,
        profileid:response.body.verificationProfileId
      })

      console.log(arrayOfObjects)
      fs.writeFile('./VerificationProfileid.json', JSON.stringify(arrayOfObjects,null,4), 'utf-8', function(err) {
        if (err) throw err
        console.log('Done!')
      })
    })
      //stream.write(resp);
  })


  
});


//For streaming Binaryjs server is established

var server = http.createServer(app);

// Start Binary.js server
var BinaryServer = require('binaryjs').BinaryServer;
var bs = BinaryServer({server: server});

// Wait for new user connections
bs.on('connection', function(client){
  // Incoming stream from browsers
  client.on('stream', function(stream, meta){
    //
    file = fs.createWriteStream(__dirname+ '/' + 'verify.wav');
    stream.pipe(file);
    //
    // Send progress back
    stream.on('data', function(data){
      //stream.write({rx: data.length / meta.size});

    });
    //on end of stream
    stream.on('end', function(){
      console.log(stream);
      console.log(file.path);
      var ffmpeg = require('fluent-ffmpeg');
      var track = file.path;//your path to source file
      ffmpeg(track)
      //.toFormat('wav').audioFrequency(16000).audioChannels(1).audioBitrate(16)
      //.audioFilters('volume=0.5','highpass=f=300','lowpass=4000')
      .audioFilters('volume=1.5','highpass=f=300','lowpass=4000')
      .on('error', function (err) {
          console.log('An error occurred: ' + err.message);
      })
      .on('progress', function (progress) {
          // console.log(JSON.stringify(progress));
          console.log('Processing: ' + progress.targetSize + ' KB converted');
      })
      .save('myvoiceverify.wav')
      .on('end', function() {
        console.log("Finished processing");

        if(meta.name=="verify")
        {
          username=meta.username;
          var pid;
          fs.readFile('./VerificationProfileid.json', 'utf-8', function(err, data) {
          if (err) throw err

          var arrayOfObjects = JSON.parse(data)
          console.log(Object.keys(arrayOfObjects.users).length);
          for(var i=0;i<Object.keys(arrayOfObjects.users).length;i++)
          {
            if((arrayOfObjects.users[i].username)==username)
            {
              pid=arrayOfObjects.users[i].profileid;
            }
          }
          console.log(pid);
          console.log("verify");
          console.log("sending..");
        unirest.post('https://westus.api.cognitive.microsoft.com/spid/v1.0/verify?verificationProfileId='+pid)
          .headers({'Content-Type': 'multipart/form-data', 'Ocp-Apim-Subscription-Key' : '530fc76e57ff41ee8af9314c8a716166'})
          .attach('file', 'myvoiceverify.wav') // Attachment
          .end(function (response) {
            console.log(response.body);
            resp=response.body;
            stream.write(resp);

          })})
        }
        else if(meta.name=="enroll")
        {
          username=meta.username;
          var pid;
          console.log("enroll");
          console.log("sending..");
          fs.readFile('./VerificationProfileid.json', 'utf-8', function(err, data) {
          if (err) throw err

          var arrayOfObjects = JSON.parse(data)
          console.log(Object.keys(arrayOfObjects.users).length);
          for(var i=0;i<Object.keys(arrayOfObjects.users).length;i++)
          {
            if((arrayOfObjects.users[i].username)==username)
            {
              pid=arrayOfObjects.users[i].profileid;
            }
          }
          console.log(pid);
          //console.log(arrayOfObjects.users[0].profileid);

        unirest.post('https://westus.api.cognitive.microsoft.com/spid/v1.0/verificationProfiles/'+pid+'/enroll')
          .headers({'Content-Type': 'multipart/form-data', 'Ocp-Apim-Subscription-Key' : '530fc76e57ff41ee8af9314c8a716166'})
          .attach('file', 'myvoiceverify.wav') // Attachment
          .end(function (response) {
            console.log(response.body);
            resp=response.body;
            stream.write(resp);
        })
        })
        }

      });




    });

  });

});
//
//

server.listen(app.get('port'));
console.log('HTTP and BinaryJS server started on port 9000');
