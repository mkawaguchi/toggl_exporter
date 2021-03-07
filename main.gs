/*
  Toggl time entries export to GoogleCalendar
  author: Masato Kawaguchi
  Released under the MIT license
  version: 1.0.2
  https://github.com/mkawaguchi/toggl_exporter/blob/master/LICENSE

  required: moment.js
    project-key: 15hgNOjKHUG4UtyZl9clqBbl23sDvWMS8pfDJOyIapZk5RBqwL3i-rlCo
*/

var CACHE_KEY          = 'toggl_exporter:lastmodify_datetime';
var TIME_OFFSET        = 9 * 60 * 60; // JST
var TOGGL_BASIC_AUTH   = 'REPLACE_ME:api_token';
var GOOGLE_CALENDAR_ID = 'REPLACE_ME';

function getLastModifyDatetime() {
  var cache = {};
  var file = DriveApp.getFilesByName('toggl_exporter_cache');
  if(!file.hasNext()) {
    var now = Moment.moment().format('X');
    var beginning_of_day = parseInt(now - (now % 86400 + TIME_OFFSET), 10).toFixed();
    putLastModifyDatetime(beginning_of_day);
    return beginning_of_day;
  }
  file = file.next();
  var data = JSON.parse(file.getAs("application/octet-stream").getDataAsString());
  return parseInt(data[CACHE_KEY], 10).toFixed();
}

function putLastModifyDatetime(unix_timestamp) {
  var cache = {};
  cache[CACHE_KEY] = unix_timestamp;
  var file = DriveApp.getFilesByName('toggl_exporter_cache');
  if(!file.hasNext()) {
    DriveApp.createFile('toggl_exporter_cache', JSON.stringify(cache));
    return true;
  }
  file = file.next();
  file.setContent(JSON.stringify(cache));
  return true;
}

function getTimeEntries(unix_timestamp) {
  var uri = 'https://www.toggl.com/api/v8/time_entries' + '?' + 'start_date=' + encodeURIComponent(Moment.moment(unix_timestamp, 'X').format());
  var response = UrlFetchApp.fetch(
    uri,
    {
      'method' : 'GET',
      'headers' : { "Authorization" : " Basic " + Utilities.base64Encode(TOGGL_BASIC_AUTH) },
      'muteHttpExceptions': true
    }
  );
  try {
    return JSON.parse(response);
  }
  catch (e) {
    Logger.log([unix_timestamp, e]);
  }
}

function getProjectData(project_id) {
  if(!!project_id == false) return {};
  var uri = 'https://www.toggl.com/api/v8/projects/'+ project_id;
  var response = UrlFetchApp.fetch(
    uri,
    {
      'method' : 'GET',
      'headers' : { "Authorization" : " Basic " + Utilities.base64Encode(TOGGL_BASIC_AUTH) },
      'muteHttpExceptions': true
    }
  );
  try {
    return JSON.parse(response).data;
  }
  catch (e) {
    Logger.log(["getProjectData", e]);
  }
}

function recordActivityLog(description, started_at, ended_at) {
  var calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
  calendar.setTimeZone('Asia/Tokyo');
  calendar.createEvent(description, new Date(started_at), new Date(ended_at));
}

function watch() {
  try {
    var check_datetime = getLastModifyDatetime();
    var time_entries = getTimeEntries(check_datetime);

    if(time_entries) {
      last_stop_datetime = null;
      for (var i=0; i<time_entries.length; i++) {
        var record = time_entries[i];
        if(record.stop == null) continue;

        var project_data = getProjectData(record.pid);
        var project_name = project_data.name || '';
        var activity_log = [(record.description || '名称なし'), project_name].filter(function(e){return e}).join(" : ");

        recordActivityLog(
          activity_log,
          Moment.moment(record.start).format(),
          Moment.moment(record.stop).format()
        );
        last_stop_datetime = record.stop;
      }
      if(last_stop_datetime) {
        putLastModifyDatetime((parseInt(Moment.moment(last_stop_datetime).format('X'), 10) + 1).toFixed());
      }
    }
  }
  catch (e) {
    Logger.log(e);
  }
}
