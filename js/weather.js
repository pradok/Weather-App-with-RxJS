var myWeather = (function(global, $, Rx) {

    const   $input = $('#keyboard'),
            $goBtn = $('#go');

    let asciiBits = {
        '7': '0x80',
        '6': '0x40',
        '5': '0x20',
        '4': '0x10',
        '3': '0x08',
        '2': '0x04',
        '1': '0x02',
        '0': '0x01'
    };

    let timeoutEachChar = 1000;

    /**
     *  Display a bit on the LED display
     * @param bit
     * @param on
     */
    function setBit(bit, on) {
       //console.log('setBit() bit:', bit, 'setBit() on:', on);
        if (on) {
            $("#bit" + bit).css("background-color", "Red");
        } else {
            $("#bit" + bit).css("background-color", "LimeGreen");
        }
    }

    /**
     * Event stream to observe any object literal.
     * @param obj
     * @returns {*}
     */
    function objectObservable(obj) {
        return Rx.Observable.pairs(obj);
    }

    /**
     * Clears the LED display back to grey
     */
    function clearDisplay() {
        setTimeout( function(){
            $(".bitbtn").css("background-color", "LightGray");
        },1000);
    }


    /**
     * Convert char to Unicode and set the LED display
     * @param ch
     */
    function chartake(ch) {
        //console.log('chartake(ch):', ch);

        // Subscribe to the objectObservable stream
        let asciiBitsSource = objectObservable(asciiBits);
        asciiBitsSource.subscribe(
            x => {
                let [key, value] = x;
               // console.log('Key:', key, 'Value:', value);
                let chCode = ch.charCodeAt(0);
                //console.log('chCode:', chCode);
                //console.log('(chCode '+chCode+' & value '+value+') > 0:', (chCode & value) > 0);
                setBit(key, (chCode & value) > 0);
            },
            err => {
               console.log('Error: %s', err);
            },
            complete => {
               // console.log('Completed');
            });
    }

    /**
     * Delay each item returned from Array as set in dueTime
     * @param array
     * @param dueTime
     * @returns {Symbol}
     */
    function arrayDelayEachStream (array, dueTime) {
        return Rx.Observable.for(array, function (item, k) {
            return Rx.Observable.return(item).delay(dueTime);
        });
    }

    /**
     * Convert text string to array.
     * Uses arrayDelayEachStream to delay return of each item in array.
     * @param text
     */
    function charArraySubscriber(text) {
        let textToArray = text.split('');
        arrayDelayEachStream(textToArray, timeoutEachChar).subscribe(
            chartake.bind(console),
            err => {
                //console.log('Error: ' + err);
            },
            () => {
                //console.log('Completed');
                clearDisplay();
            }
        );
    }


    /**
     * Event stream to observe Form input changes
     * @returns {Array}
     */
    function inputTextStream () {
        return Rx.Observable.fromEvent($input, 'change')
            .map(e => e.target.value);
    }

    /**
     * Event stream to observe Go button clicks
     * @returns {*}
     */
    function goButtonStream () {
        return Rx.Observable.fromEvent($goBtn, 'click');
    }

    /**
     * Event stream to listen for Go button and input stream
     * @returns {*}
     */
    function inputGoButtonStream() {
        let inputTextStreamSubsribe = inputTextStream(),
            goButtonStreamSubscribe = goButtonStream();

        return goButtonStreamSubscribe.withLatestFrom(
            inputTextStreamSubsribe,
            (src1, src2) => {return src2}
        )
    }

    /**
     * Subscribe to inputGoButtonStream event stream for its value
     * @returns {*}
     */
    function inputValueSubscriber() {

        return inputGoButtonStream().subscribe(
            inputValue => {
                //console.log('inputValue: ' + inputValue);
                charArraySubscriber(inputValue);
            },
            err => {
                //console.log('Error: ' + err);
                
            },
            () => {
                //console.log('Completed');
            });
    }

    /**
     * Weather api
     * @param search
     * @returns {*} as Promise
     */
    function weatherStream(search) {

        let locate = search || 'Melbourne';
        locate += ', AU'
        console.log('locate: ', locate);
        let unit = "c";
        let now = new Date();

        return $.ajax({
            url: 'https://query.yahooapis.com/v1/public/yql',
            dataType: 'jsonp',
            data: {
                format: 'json',
                q: 'select * from weather.forecast where woeid in (select woeid from geo.places(1) where text="' + locate + '") and u="' + unit + '"',
                rnd: now.getFullYear() + now.getMonth() + now.getDay() + now.getHours(),
                diagnostics: 'true'

            }
        }).promise();

    }

    /**
     * Populate Weather.
     * @param data
     */
    function renderWeather(data) {
        let weather = data.query.results.channel,
            city = weather.location.city,
            temp = weather.item.condition.temp+'&deg;'+weather.units.temperature,
            wcode = '<img class="weathericons" src="images/weathericons/'+weather.item.condition.code+'.svg">',
            wind = '<p>'+weather.wind.speed+'</p><p>'+weather.units.speed+'</p>',
            humidity = weather.atmosphere.humidity + '%';

        $('[rel="location"]').text(city);
        $('[rel="temperature"]').html(temp);
        $('.climate_bg').html(wcode);
        $('[rel="windspeed"]').html(wind);
        $('[rel="humidity"]').html(humidity);
    }

    // Animate the string into the LED display


    return {
        subscribeInputText : inputValueSubscriber,
        inputGoButtonStream: inputGoButtonStream,
        weather: weatherStream,
        renderWeather: renderWeather
    };


})(window, jQuery, Rx);


// Listen for Input text and Go button event streams,
// display LED and search weather from the input string.
myWeather.subscribeInputText();


// Listen for Go button and input value change event stream and pass on to weather
let onWeatherGoPress = myWeather.inputGoButtonStream().flatMapLatest(myWeather.weather);

// Listen for Weather api response.
onWeatherGoPress.subscribe(
    response => {
        console.log(response);
        myWeather.renderWeather(response);
    },
    error => {

    }
);


var currentLocation;
// Show current location on page load.
if("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
        currentLocation = position.coords.latitude+','+position.coords.longitude;
        console.log('currentLocation: ', currentLocation);
        myWeather.weather().done(
            response => {
                console.log('weather data:', response);
                myWeather.renderWeather(response);
            }
        );
    });
}
