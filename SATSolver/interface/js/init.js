const d3 = require('d3');
const net = require('net');
const remote =  require('electron').remote;
const ProgressBar = require('progressbar.js');
const canvasBuffer = require('electron-canvas-to-buffer');
const DragTimetable = require('drag-timetable');

const {
  Menu,
  MenuItem
} = require('electron').remote;

var is_processing_message = false;

var progress_bar = new ProgressBar.Circle('#progress-circle', {
  color: '#FFF',
  strokeWidth: 15,
  trailWidth: 4,
  easing: 'easeInOut',
  duration: 1400,
  text: {
    autoStyleContainer: true
  },
  from: { color: '#0EBFE9', width: 4 },
  to: { color: '#0EBFE9', width: 4 },
  step: function(state, circle) {
    circle.path.setAttribute('stroke', state.color);
    circle.path.setAttribute('stroke-width', state.width);
    let value = Math.round(circle.value() * 1000) / 10;

    if (value === 0) {
      circle.setText('0');
    } else {
      circle.setText(value);
    }

  }
});

progress_bar.animate(0.0);

// Bindings

var perc = new Vue({
  el: '#perc',
  data: {
    percentage: 0
  }
});

var terminal = new Vue({
	el: '#term',
	data : {
		text : ""
	}
});

var error_log = new Vue({
  el: "#err",
  data : {
    text : ""
  }
});

var time_elapsed = new Vue({
   el: "#time",
    data: {
     elapsed: 0,
        start: 0,
        finish: 0
    }
});

var best_individual = new Vue({
    el: "#fitness",
    data: {
      fitness: 0,
      individual: null,
      array : [[]]
    }
});

var current_child = new Vue({
    data: {
      fitness: 0,
      individual: null,
      array : [[]]
    }
});

var formula_info = new Vue({
    el: "#formula-info",
    data: {
        num_clauses: 0,
        num_variables: 0
    }
});

var generations = new Vue({
    el: "#generations",
    data: {
      generations: 0,
      max_generations: 1000
    }
});

// Connection

// Create connection and establish callbacks.

conn = new net.Socket();

var HOST = '127.0.0.1';
var PORT = '55555';

conn.connect(PORT, HOST, function() {
    console.log('Connected');
    $("#connected-indicator")[0].style.fill = "lime";
    conn.connected = true;
    conn.data = "";
});

var be_disconnect = false;

function disconnect() {
    console.log('Disconnecting...');
    try {
        conn.write('CLOSE#');
        be_disconnect = true;
    } catch (e) {
        console.log(e);
    }
    $('#disconnect').addClass('disabled');
    $('#connect').removeClass('disabled');
}

function connect(_HOST, _PORT) {
    HOST = _HOST;
    PORT = _PORT;
    console.log('Connecting on ' + HOST + ':' + PORT);
    conn.connect(PORT, HOST, function() {
        console.log('Connected');
        $("#connected-indicator")[0].style.fill = "lime";
        conn.connected = true;
        conn.data = "";
    });
    be_disconnect = false;
    $('#disconnect').removeClass('disabled');
    $('#connect').addClass('disabled');
}

function process_message(data) {
  data = data.slice(0, -1);

  console.log('Received: ' + data);
  terminal.text += "\n" + data;

  var response = JSON.parse(data);
  var message_type;
  for (let key in response["RESPONSE"]) {
      message_type = key;
  }

  function progress() {
      try {
          graph_chart.update();
        progressObject = JSON.parse(data);
        progressArray = progressObject["RESPONSE"]["PROGRESS"];
        perc.percentage = (progressArray["NUM_CLAUSES"][0]-progressArray["BEST_INDIVIDUAL_FITNESS"][0]) / progressArray["NUM_CLAUSES"][0];
        generations.generations = progressArray["GENERATION"][0];
        generations.max_generations = progressArray["GENERATION"][1];
        best_individual.fitness = progressArray["BEST_INDIVIDUAL_FITNESS"][0];
        best_individual.individual = progressArray["BEST_INDIVIDUAL"][0];
        current_child.fitness = progressArray["CURRENT_CHILD_FITNESS"][0];
        current_child.individual = progressArray["CURRENT_CHILD"][0];
        time_elapsed.start = progressArray["TIME_STARTED"][0];
        time_elapsed.finish = 0;

        formula_info.num_clauses = progressArray["NUM_CLAUSES"][0];
        formula_info.num_variables = progressArray["NUM_VARIABLES"][0];


          $('#progress').show();
          $('#main-card').hide();

        if (progressArray["CURRENT_CHILD"] !== "None") {
            new_child = progressArray["TRUE_CLAUSES_CURRENT_CHILD"][0].split('').map((item) => {
                return parseInt(item, 10);
            });
            new_best = progressArray["TRUE_CLAUSES_BEST_INDIVIDUAL"][0].split('').map((item) => {
                return parseInt(item, 10);
            });

            current_child.array[0].push.apply(current_child.array[0], new_child);
            best_individual.array[0].push.apply(best_individual.array[0], new_best);
            $("#child-chart").html('');
            $("#best-chart").html('');
             // console.log('Here');
            // Data culling

            if (current_child.array[0].length > 10*new_child.length) {
                current_child.array[0] = current_child.array[0].slice(-10*new_child.length);
            }

            if (best_individual.array[0].length > 10*new_child.length) {
                best_individual.array[0] = best_individual.array[0].slice(-10*new_child.length);
            }

            circularHeat(current_child.array, best_individual.array, new_child.length);
        }

        if (!graph_chart.data.labels.includes(progressArray["GENERATION"][0])) {
          graph_chart.data.labels.push(progressArray["GENERATION"][0]);
          graph_chart.data.datasets[0].data.push(progressArray["BEST_INDIVIDUAL_FITNESS"][0]);
          graph_chart.data.datasets[1].data.push(progressArray["CURRENT_CHILD_FITNESS"][0]);
          graph_chart.update();
        }
      } catch(e) {
        $("#connected-indicator")[0].style.fill = "yellow";
        console.log(e)
      }
  }

  function finished() {
      try {
        let progressObject = JSON.parse(data);
        let finishedArray = progressObject["RESPONSE"]["FINISHED"];
        // perc.percentage = (progressArray["NUM_CLAUSES"][0]-finishedArray["FITNESS"][0]) / progressArray["NUM_CLAUSES"][0];
        generations.generations = finishedArray["GENERATION"][0];
        generations.max_generations = finishedArray["GENERATION"][1];
        best_individual.fitness = finishedArray["FITNESS"];
        time_elapsed.start = finishedArray["TIME_STARTED"];
        time_elapsed.finish = finishedArray["TIME_FINISHED"];
        var true_clauses = finishedArray["TRUE_CLAUSES"];
        graph_chart.update();
        let status_title = $('#status-title');
        if (finishedArray["SUCCESSFUL"] === true) {
            status_title.addClass('success');
            $('#solution-desc').text('Solution:');
            status_title.html('Successfully found a solution.');
            $('#answer-clauses-form').hide();
        } else {
            status_title.addClass('failed');
            status_title.html('Could not find a solution.');
            $('#solution-desc').text('Best Solution Found:');
            $('#answer-clauses-form').show();

            true_clauses = true_clauses.split('');
            var true_clauses_num = '';
            for (var i = 0; i < true_clauses.length; i++) {
                if (true_clauses[i] === '0') {
                    true_clauses_num += i + ', ' ;
                }
            }
            true_clauses_num = true_clauses_num.slice(0, -2);
            $('#answer-clauses').val(true_clauses_num);
        }

        $('#status').removeClass('hide');
        $('#answer-container').show();
        $('#answer').val(finishedArray["INDIVIDUAL"]);
        $('#stop-button').hide();
        $('#back-button').show();

        console.log(current_child.array[0]);
        console.log(best_individual.array[0]);

      } catch(e) {
        $("#connected-indicator")[0].style.fill = "yellow";
        console.log(e);
        $('#stop-button').hide();
        $('#back-button').show();
      }
  }

  function error() {
      try {
          let errorObject = JSON.parse(data);
          error_log.text += "\n" + errorObject["RESPONSE"]["ERROR"];
          alert("Server says: " + errorObject["RESPONSE"]["ERROR"]);
      } catch(e) {
        $("#connected-indicator")[0].style.fill = "yellow";
        console.log(e)
      }
  }

  var options = {
    "PROGRESS": progress,
    "FINISHED": finished,
    "ERROR": error
  };

  options[message_type](data);
  progress_bar.animate(perc.percentage);
}

function process_data(data) {
    conn.data += data;
    if (!is_processing_message) {
        is_processing_message = true;
        while (conn.data.indexOf('#') !== -1) {
            process_message(conn.data.slice(0, conn.data.indexOf('#')+1));
            conn.data = conn.data.slice(conn.data.indexOf('#')+1, conn.data.length);
        }
        is_processing_message = false;
    }

}

conn.on('data', function(data) {
    if (HOST === "127.0.0.1" || HOST.toLowerCase() === "localhost") {
        process_message(data);
    } else {
        process_data(data);
    }
    // process_message(data);
});

conn.on('close', function() {
  console.log('Connection closed');
  $("#connected-indicator")[0].style.fill = "red";
  conn.connected = false;
  conn.data = "";
  $('#disconnect').addClass('disabled');
  $('#connect').removeClass('disabled');
  $('#back-button').show();
  time_elapsed.finish = (new Date).getTime();
  $('#stop-button').hide();
});


var graph_chart;
$(document).ready(function () {
    $('#progress').hide();
    graph_chart = default_chart();
});

function default_chart() {
    $('#fitness-chart').remove();
    $('#chart-container').append('<canvas id="fitness-chart"><canvas>');
    var accent_colour = $('button').css('backgroundColor');
    var ctx = document.getElementById('fitness-chart').getContext('2d');
    var default_chart_var = new Chart(ctx, {
        // The type of chart we want to create
        type: 'line',

        // The data for our dataset
        data: {
            labels: [],
            datasets: [{
                label: "Fittest Individual",
                backgroundColor: accent_colour,
                borderColor: accent_colour,
                fill: false,
                lineTension: 0,
                data: []
            },{
                label: "Newest Child Fitness",
                backgroundColor: '#ccc',
                borderColor: '#ccc',
                fill: false,
                data: []
            }]
        },

        // Configuration options go here
        options: {
            elements: {
                line: {
                    tension: 0
                }
            },
            scales: {
                xAxes: [{
                  scaleLabel: {
                    display: true,
                    labelString: 'Generations'
                  },
                  ticks: {
                      autoSkip: true,
                      maxTicksLimit: 25
                  }
              }],
              yAxes: [{
                  scaleLabel: {
                    display: true,
                    labelString: 'Fitness (Unsolved Clauses)'
                  },
                  ticks: {
                      autoSkip: true,
                      maxTicksLimit: 25
                  }
              }]
            }
        }
    });

    return default_chart_var;
}

window.setInterval(function() {
    var calculated_elapsed;
    if (time_elapsed.finish === 0) {
        calculated_elapsed = (((new Date).getTime() - time_elapsed.start));
    } else {
        calculated_elapsed = time_elapsed.finish - time_elapsed.start;
    }

    if (calculated_elapsed < 1000) {
        time_elapsed.elapsed = (calculated_elapsed.toString()).slice(-3) + 'ms';
    } else if (calculated_elapsed < 60000) {
        time_elapsed.elapsed = moment(calculated_elapsed).format('s') + 's ' + (calculated_elapsed.toString()).slice(-3);
    } else if (calculated_elapsed < 3600000) {
        time_elapsed.elapsed = moment(calculated_elapsed).format('m') + 'm ' + moment(calculated_elapsed).format('s') + 's ' + (calculated_elapsed.toString()).slice(-3);
    } else {
        time_elapsed.elapsed = moment(calculated_elapsed-93600000).format('H') + 'h ' + moment(calculated_elapsed-93600000).format('m') + 'm ' + moment(calculated_elapsed-93600000).format('s') + 's ' + (calculated_elapsed.toString()).slice(-3);
    }
}, 1);

window.setInterval(function() {
    if (conn.connected === false && !be_disconnect) {
        conn.connect(PORT, HOST, function() {
            console.log('Connected');
            conn.data = "";
            $("#connected-indicator")[0].style.fill = "lime";
            conn.connected = true;
            $('#disconnect').removeClass('disabled');
            $('#connect').addClass('disabled');
        });
    }
}, 5000);

function reset() {
    time_elapsed.start = 0;
    time_elapsed.finish = 0;
    generations.max_generations = 0;
    generations.generations = 0;
    best_individual.fitness = 0;
    best_individual.individual = null;
    best_individual.array = [[]];
    current_child.fitness = 0;
    current_child.individual = null;
    current_child.array = [[]];
    formula_info.num_variables = 0;
    formula_info.num_clauses = 0;

    graph_chart = default_chart();
    graph_chart.update();

    $('#status').addClass('hide');
    $('#answer-container').hide();
    $('#progress').hide();
    $('#main-card').show();
    $('#status-title').removeClass('success');
    $('#status-title').removeClass('failed');
    $('#stop-button').show();
    $('#back-button').hide();

}

function circularHeat(child_data, best_data, numSegments) {
    let chart = circularHeatChart(numSegments).range(["white",
    getComputedStyle(document.body).getPropertyValue('--theme-four')]);
    d3.select('#child-chart').selectAll('svg').data(child_data).enter().append('svg').call(chart);
    d3.select('#best-chart').selectAll('svg').data(best_data).enter().append('svg').call(chart);
}
