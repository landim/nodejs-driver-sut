var cassandra = require('cassandra-driver');
var async = require('async');
var Uuid = cassandra.types.Uuid;
var TimeUuid = cassandra.types.TimeUuid;
/**
 * @const
 */
var queries = {
  insertCredentials: 'INSERT INTO user_credentials (email, password, userid) VALUES (?, ?, ?)',
  getCredentials: 'SELECT email, password, userid FROM user_credentials WHERE email = ?',
  insertVideo: 'INSERT INTO videos (videoid, userid, name, description, location, location_type,' +
               ' preview_thumbnails, tags, added_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  getVideo: 'SELECT videoid, userid, name, description, location, location_type, preview_thumbnails, tags, ' +
            ' added_date FROM videos WHERE videoid = ?',
  insertVideoEvent: 'INSERT INTO video_event (videoid, userid, event, event_timestamp, video_timestamp) VALUES' +
                    ' (?, ?, ?, ?, ?)',
  getVideoEvent: 'SELECT videoid, userid, event, event_timestamp, video_timestamp FROM video_event WHERE' +
                 ' videoid = ? and userid = ?'
};

/**
 * @param {Client} client
 * @param {MetricsTracker} tracker
 * @param {Number} times
 * @param {Number} limit
 * @constructor
 */
function Repository(client, tracker, times, limit) {
  this.client = client;
  this.tracker = tracker;
  this.times = times;
  this.limit = limit;
}

Repository.prototype.insertCredentials = function (prepare, email, password, callback) {
  var self = this;
  var id = Uuid.random();
  password = password || email;
  var trackerKey = prepare ? 'prepared.insert.user_credentials' : 'simple.insert.user_credentials';
  var params = [ email, password, id ];
  async.timesLimit(this.times, this.limit, function (n, next) {
    self.execute(prepare, trackerKey, queries.insertCredentials, params, next);
  }, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, { email: email, password: password, userid: id});
  });
};

Repository.prototype.getCredentials = function (prepare, email, callback) {
  var self = this;
  var trackerKey = prepare ? 'prepared.select.user_credentials' : 'simple.select.user_credentials';
  var params = [ email ];
  var getResult;
  async.timesLimit(this.times, this.limit, function (n, next) {
    self.execute(prepare, trackerKey, queries.getCredentials, params, function (err, result) {
      if (err) return next(err);
      getResult = result.first();
      next();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, getResult);
  });
};

Repository.prototype.insertVideo = function (prepare, video, callback) {
  var self = this;
  var trackerKey = prepare ? 'prepared.insert.video' : 'simple.insert.video';
  video.videoid = Uuid.random();
  var params = [
    video.videoid,
    Uuid.fromString(video.userid),
    video.name,
    video.description,
    video.location,
    parseInt(video.location_type, 10),
    video.preview_thumbnails,
    video.tags,
    new Date(video.added_date)
  ];
  async.timesLimit(this.times, this.limit, function (n, next) {
    self.execute(prepare, trackerKey, queries.insertVideo, params, function (err) {
      next(err);
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, video);
  });
};

Repository.prototype.getVideo = function (prepare, videoId, callback) {
  var self = this;
  var trackerKey = prepare ? 'prepared.select.video' : 'simple.select.video';
  var params = [ videoId ];
  var getResult;
  async.timesLimit(this.times, this.limit, function (n, next) {
    self.execute(prepare, trackerKey, queries.getVideo, params, function (err, result) {
      if (err) return next(err);
      getResult = result.first();
      next();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, getResult);
  });
};

Repository.prototype.insertVideoEvent = function (prepare, videoEvent, callback) {
  var self = this;
  var trackerKey = prepare ? 'prepared.insert.video_event' : 'simple.insert.video_event';
  var params = [
    Uuid.fromString(videoEvent.videoid),
    Uuid.fromString(videoEvent.userid),
    videoEvent.event,
    TimeUuid.fromString(videoEvent.event_timestamp),
    cassandra.types.Long.fromString(videoEvent.video_timestamp)
  ];
  async.timesLimit(this.times, this.limit, function (n, next) {
    self.execute(prepare, trackerKey, queries.insertVideoEvent, params, function (err) {
      next(err);
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, videoEvent);
  });
};

Repository.prototype.getVideoEvent = function (prepare, videoid, userid, callback) {
  var self = this;
  var trackerKey = prepare ? 'prepared.select.video_event' : 'simple.select.video_event';
  var params = [ videoid, userid ];
  var getResult;
  async.timesLimit(this.times, this.limit, function (n, next) {
    self.execute(prepare, trackerKey, queries.getVideoEvent, params, function (err, result) {
      if (err) return next(err);
      getResult = result.first();
      next();
    });
  }, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, getResult);
  });
};

Repository.prototype.execute = function (prepare, trackerKey, query, params, callback) {
  var tracker = this.tracker;
  var startTime = process.hrtime();
  this.client.execute(
    query,
    params,
    { prepare: prepare },
    function (err, result) {
      if (err) {
        return callback(err);
      }
      tracker.update(trackerKey, process.hrtime(startTime), function () {
        callback(null, result);
      });
    });
};

module.exports = Repository;