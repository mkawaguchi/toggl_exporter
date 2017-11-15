/*
  Toggl event watcher
  Copyright (c) 2017 Masato Kawaguchi
  Released under the MIT license
  https://github.com/mkawaguchi/toggl_exporter/blob/master/LICENSE

  required: moment.js
    project-key: MHMchiX6c1bwSqGM1PZiW_PxhMjh3Sh48
*/

var INTERVAL_TIME = 60;
var TOGGL_BASIC_AUTH = 'REPLACE_ME:api_token';
var IFTTT_WEBHOOK_API_KEY = 'REPLACE_ME'
var IFTTT_WEBHOOK_EVENT_NAME = 'REPLACE_ME';
var GOOGLE_CALENDAR_ID ='REPLACE_ME@group.calendar.google.com';

function watch() {
  var response = UrlFetchApp.fetch(
    'https://www.toggl.com/api/v8/time_entries/current', {
      'method' : 'GET',
      'headers' : {"Authorization" : " Basic " + Utilities.base64Encode(TOGGL_BASIC_AUTH)},
      'muteHttpExceptions': true
    }
  );
  response = JSON.parse(response);

  if(response.data != null){
    var started_at = Moment.moment(response.data.start);
    var now = Moment.moment();

    // Logger.log(new Date("2017-03-19T06:35:11.000Z"));
    // Logger.log(new Date("2013-01-17T17:34:50.508Z"));
    var duration = now.diff(started_at, 'minutes');

    if(duration > INTERVAL_TIME) {
      notification(response.data);
      recordActivityLog(
        response.data.description || '名称なし',
        Moment.moment(started_at, "YYYY-MM-DD HH:mm:ss"),
        Moment.moment(now, "YYYY-MM-DD HH:mm:ss")
      );
      stopTogglTimer(response.data.id);
    }
  }
}

function stopTogglTimer(time_entry_id) {
  var response = UrlFetchApp.fetch(
    'https://www.toggl.com/api/v8/time_entries/'+ time_entry_id +'/stop', {
      'method' : 'PUT',
      'headers' : {"Authorization" : " Basic " + Utilities.base64Encode(TOGGL_BASIC_AUTH)},
      'muteHttpExceptions': true
    }
  );
  Logger.log({
    response: JSON.parse(response)
  });
}

function unixTime(date) {
  return Math.floor( date.getTime() / 1000 );
}

function notification(data) {
  var description = data.description ? data.description : '実行中のタスク';
  UrlFetchApp.fetch(
    'https://maker.ifttt.com/trigger/'+ IFTTT_WEBHOOK_EVENT_NAME +'/with/key/' + IFTTT_WEBHOOK_API_KEY, {
      'method' : 'POST',
      'contentType': 'application/json',
      'payload' : JSON.stringify({"value1": description +"終わりました？"}),
      'muteHttpExceptions': true
    }
  );
}

function recordActivityLog(description, started_at, ended_at) {
  var calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
  calendar.createEvent(
    description,
    new Date(started_at),
    new Date(ended_at)
  );
}
