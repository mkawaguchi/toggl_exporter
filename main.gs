/*
  Toggl time entries export to GoogleCalendar
  author: Masato Kawaguchi
  Released under the BSD-3-Clause license
  version: 1.1.0
  https://github.com/mkawaguchi/toggl_exporter/blob/master/LICENSE

  required: moment.js
    project-key: 15hgNOjKHUG4UtyZl9clqBbl23sDvWMS8pfDJOyIapZk5RBqwL3i-rlCo

  Copyright 2024, Masato Kawaguchi

  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

  1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
  2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
  3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var CACHE_KEY            = 'toggl_exporter:lastmodify_datetime';
var TIME_OFFSET          = 9 * 60 * 60; // JST
var TOGGL_API_HOSTNAME   = 'https://api.track.toggl.com';
var TOGGL_BASIC_AUTH     = 'DUMMY:api_token';
var GOOGLE_CALENDAR_ID   = 'DUMMY';

// 不具合時に使用
function clearScriptCache() {
  var cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY);
  return true;
}

function beginningOfDay() {
  var now = Moment.moment().format('X');
  return parseInt(now - (now % 86400 + TIME_OFFSET), 10).toFixed();
}

function getLastModifyDatetime() {
  var cache = CacheService.getScriptCache();
  var data = parseInt(JSON.parse(cache.get(CACHE_KEY) || "-1"));
  
  if( data < 0 ) {
    var beginning_of_day = beginningOfDay();
    putLastModifyDatetime(beginning_of_day);
    return beginning_of_day;
  }
  return data;
}

function putLastModifyDatetime(unix_timestamp) {
  var cache = CacheService.getScriptCache();
  cache.put(CACHE_KEY, unix_timestamp, 6*60*60);
  return true;
}

function getTimeEntries(unix_timestamp) {
  var uri = TOGGL_API_HOSTNAME + '/api/v9/me/time_entries' + '?' + 'start_date=' + encodeURIComponent(Moment.moment(unix_timestamp, 'X').format()) + "&" + 'end_date=' + encodeURIComponent(Moment.moment(unix_timestamp + (86400), 'X').format());
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
  var uri = TOGGL_API_HOSTNAME + '/api/v9/me/projects/'+ project_id;
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
      for (var i=0; i < time_entries.length; i++) {
        var record = time_entries[i];
        if(record.stop == null) {
          continue;
        }
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
        putLastModifyDatetime((parseInt(Moment.moment(last_stop_datetime).format('X'), 10) + 10).toFixed());
      }   
    }   
  }
  catch (e) {
    Logger.log(e);
  }
}
