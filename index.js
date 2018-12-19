const express = require("express");
const AWS = require("aws-sdk");
const API = require("last.fm.api"),
  lastFmApi = new API({
    apiKey: process.env.LASTFM_API_KEY
  });
const app = express();

const BUCKET_NAME = "audioplayer-aula";

const listAllKeys = (params, out = []) =>
  new Promise((resolve, reject) => {
    const s3 = new AWS.S3({ region: "sa-east-1" });
    return s3
      .listObjectsV2(params)
      .promise()
      .then(({ Contents, IsTruncated, NextContinuationToken }) => {
        out.push(...Contents);
        if (!IsTruncated) {
          resolve(out);
        } else {
          resolve(
            listAllKeys(
              Object.assign(params, {
                ContinuationToken: NextContinuationToken
              }),
              out
            )
          );
        }
      })
      .catch(reject);
  });

app.get("/play", (req, res) => {
  var s3 = new AWS.S3({ region: "sa-east-1" });
  const mbid = req.query.id;
  s3.getObject({
    Bucket: BUCKET_NAME,
    Key: `${mbid}.mp3`
  })
    .on("httpHeaders", (statusCode, headers) => {
      res.set("Content-Type", headers["content-type"]);
      this.response.httpResponse.createUnbufferedStream().pipe(res);
    })
    .on("error", err => {
      res.status(500).send(err);
    })
    .send();
});

app.get("/songs", (req, res) => {
  return listAllKeys({ Bucket: BUCKET_NAME }).then(data => {
    const promises = data.map(entry => {
      return lastFmApi.track
        .getInfo({ mbid: entry.Key.slice(0, -4) })
        .then(data => data);
    });
    Promise.all(promises)
      .then(tracks => {
        res.status(200).json(tracks);
      })
      .catch(err => {
        res.status(500).send(err);
      });
  });
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});
