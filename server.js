
var fs = require('fs');
var http = require('http');
const request = require('request');
var unirest = require('unirest');
var file;
var resp;
var profileid;
var promise=require('promise');
var config = {
  user:'postgres',
  database:'postgres',
  password: 'pega@123',
  host: '52.37.247.51',
  port: 5433, //env var: PGPORT
  max: 10, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
};
var pool = new pg.Pool(config);
function checkExist(rows,id)
{
  return new promise(function(resolve,reject)
{
  for(var i=0;i<rows.length;i++)
  {

    if(rows[i].device_name==id)
    {
      //console.log("unsuccess");
      return reject("Unsucess");
    }

  }
  //console.log("success");
  return resolve("Suceess");
});
}
function checkUsernameExist(id)
{
return new promise(function(resolve,reject)
{
  pool.connect(function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }
  client.query('SELECT vr_generated_profileid from sensordata.voicerecog_pofileid_mst where username=\''+id+'\'', function(err, result) {
    done(err);
    if(err) {
      //console.error('error running query', err);
      return resolve("Success");
    }
    if(result.rows.length>0)
    {
      return reject(result.rows[0].status);
    }
    return resolve("Success");
  /*  checkExist(result.rows,id).then(function(result)
  {
    return resolve(result);
  },function(error)
{
  return reject(error);
});*/

});
});
pool.on('error', function (err, client) {

  console.error('idle client error', err.message, err.stack)
})
});
}
// Serve client side statically
var express = require('express');
var app = express();
app.set('port', (process.env.PORT || 9000));

app.use(express.static(__dirname + '/public'));
app.get('/users/:subid/:id', function(req, res) {
   checkUsernameExist(req.params.id).then(function(result){
      console.log("post call"+result);
      unirest.post('https://westus.api.cognitive.microsoft.com/spid/v1.0/verificationProfiles')
        .headers({'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key' : req.params.subid})
        .send("{\"locale\":\"en-us\",}")
        .end(function (response) {
          pool.connect(function(err, client, done) {
          if(err) {
            return console.error('error fetching client from pool', err);
          }
          client.query('Insert into sensordata.voicerecog_pofileid_mst(username,vr_generated_profileid) values(\''+req.params.id+'\',\''+response.body.verificationProfileId+'\')', function(err, result) {
            done(err);
            if(err) {
              return console.error('error running query', err);
            }
            res.send("Id created");
          });
        });
      });
    },function(error){
      res.send("Already exist");
    });
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
          checkUsernameExist(meta.username).then(function(result){
            stream.write("Invalid username");
          },function(result)
          {
            console.log("verify");
            console.log("sending..");
          unirest.post('https://westus.api.cognitive.microsoft.com/spid/v1.0/verify?verificationProfileId='+result)
            .headers({'Content-Type': 'multipart/form-data', 'Ocp-Apim-Subscription-Key' : meta.subid})
            .attach('file', 'myvoiceverify.wav') // Attachment
            .end(function (response) {
              console.log(response.body);
              resp=response.body;
              stream.write(resp);

            });
          });
        }
        else if(meta.name=="enroll")
        {
          username=meta.username;
          //var pid;
          checkUsernameExist(meta.username).then(function(result){
            stream.write("Invalid username");
          },function(result)
          {
          console.log("enroll");
          console.log("sending..");

          //console.log(arrayOfObjects.users[0].profileid);

        unirest.post('https://westus.api.cognitive.microsoft.com/spid/v1.0/verificationProfiles/'+result+'/enroll')
          .headers({'Content-Type': 'multipart/form-data', 'Ocp-Apim-Subscription-Key' : meta.subid})
          .attach('file', 'myvoiceverify.wav') // Attachment
          .end(function (response) {
            console.log(response.body);
            resp=response.body;
            stream.write(resp);
        });});
        }

      });




    });

  });

});
//
//

server.listen(app.get('port'));
console.log('HTTP and BinaryJS server started on port 9000');
