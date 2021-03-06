# elmap

[![travisci](https://api.travis-ci.org/MatthiasKainer/elmap.svg?branch=master)](https://travis-ci.org/MatthiasKainer/elmap/) [![npm version](https://badge.fury.io/js/elmap.svg)](https://badge.fury.io/js/elmap) [![Coverage Status](https://coveralls.io/repos/github/MatthiasKainer/elmap/badge.svg)](https://coveralls.io/github/MatthiasKainer/elmap)

A module that allows you to perform queries with transformations on your elasticsearch. Supposed to be used for your ELK-Stack, where you may want to refine certain kibana queries and add map/reduce functionality to them.

Featuring query-result caching, so no worries if you have to play around with your transformations. 

## Install

`npm install elmap --save`

## Usage 

Given you have an index `YourElasticSearchIndex` with the data like somewhat likes this:

```json
{
    "serviceName": "my microservice",
    "callDurationMs": "128",
    "message": "Something got badly wrong in 'Someclass' for traceid 'traceid_1' in instance 'instanceid'"
},
{
    "serviceName": "my microservice",
    "callDurationMs": "1024",
    "message": "Something got badly wrong in 'NotImplemented' for traceid 'traceid_1' in instance 'instanceid'"
},
{
    "serviceName": "my microservice",
    "callDurationMs": "42",
    "message": "Something got badly wrong in 'Someclass' for traceid 'traceid_2' in instance 'instanceid'"
},
{
    "serviceName": "my microservice",
    "callDurationMs": "1",
    "message": "Something got badly wrong in 'Someclass' for traceid 'traceid_64' in instance 'anotherinstanceid'"
}
```

you may notice your index is bad for querying with kibana. Call duration is not a number, so you cannot use mathematical operators. While you can search for the traceid, you cannot easily get all traces for an instance (if you would want that - just an example). But you cannot change your index (because it's 3am in the morning and you are in the middle of an incident, or because DevOps does not exist in your company yet and you are not allowed to do anything about the index).

When you want to search further anyway, elmap can help. 

```js
import elmap from "elmap";
import {helpers} from "elmap";

const transform = (result) => {
    return result.hits.hits.map(hit => {
        const reg = /.*?'(.*?)'.*?'(.*?)'.*?'(.*?)'/;
        const matches = reg.exec(hit.message);
        return {
            duration : parseInt(hit.callDurationMs),
            trace : matches[2],
            instance : matches[3]
        };
    })
    .filter(hit => hit.duration > 50)
    .reduce((hit, current) => {
        const {instance, trace, duration} = current;
        return helpers.push(hit, `${instance}.${trace}`, duration);
    }, {});
};

const range = {
    from : new Date(new Date().getTime() + -15*60000),
    to: new Date()
}

elmap({
    url: "http://localhost:9300", 
    index: "YourElasticSearchIndex*", 
    query: 'message:"instanceid"', 
    transform,
    range 
})
```

Gives you a result that looks like 

```json
{
    "instanceid" : {
        "traceid_1": [
            128,
            1024
        ],
        "traceid_2": [
            42
        ]
    }
}
```

All the beauty of map reduce now with elasticsearch queries.

## Params

| Field | Description |
|---|---|
| url | The url for your elasticsearch instance in the format protocol://url:port, i.e. http://localhost:9300. Supports query through kibana as well, i.e. https://kibana:kibana@yourkibana.net/elasticsearch | 
| index | The ElasticSearch Index you want to query | 
| query | Your search query | 
| transform | A function that applies a specified function on your queries result. See below for more details |
| range | A javascript object with two fields, `from` and `to` both `Date` Object as option to specify the daterange to query. Default is the last 15min | 

### The transformation

Transformation is a function that is called after the query to elasticsearch is completed. It has the following signature:

```js
transform : (result: ElasticResult) => Object
```

The ElasticResult is a plain ElasticSearch Result Object and is what you see when you view the response results in kibana. Don't worry if you are not entirely sure about the result - After your first query there is a new folder `data` in your directory that you can use to take a closer look. If the file is too big, make your first transformation to look like this:

```js
(result) => {
    return result.hits.hits[0];
}
```

This will show your first hit. From there you should be able to proceed.

### The caching

Querying ElasticSearch can be slow if you have a lot of items. Which you tend to have, that's why you used elasticsearch in the first place. To be able to execute multiple transformations faster, `elmap` stores the result for a datetime/query combination in the `data` folder. If you want this folder for something else you can set it by the environment variable `ELMAP_PATH` (relative to your current working directory).

If your result changes because you changed your elasticsearch index for instance, pls do not forget to clear your cache first.

Note that as long as you query the last 15 minutes (default) the cache won't do you any good, as the last 15 Minutes change for like every millisecond!

### Result

Elmap will return an promise with the result of the transformation, so continue your code there and not in the transform callback. 

## Helpers

To make object creation more convienient, elmap comes with some helpers to make object creation easier.

You can include them using 
```js
const helpers = require("elmap").helpers;
// or 
import { helpers } from "elmap";
```

### Result Prettifiers

Result Prettyfiers are functions that should help you make your result more comprehensible.

| Function | Usage | Description | 
|---|---|---|
| sortProps| [test](blob/master/test/utils/sortProps.js) | Sorts all properties in all objects and their children. |


### Object helpers

Object helpers allow you to safely and easy set fields in objects that does not have existed before. This can be helpful for reduce functions. 

| Function | Usage | Description | 
|---|---|---|
| set| [test](blob/master/test/utils/set.js) | sets an object at a field. Overwrite everything that was there. |
| push| [test](blob/master/test/utils/push.js) | Pushes an element onto an array. Creates array if not there yet. |
| increment| [test](blob/master/test/utils/increment.js) | Increments a number on a field. |
| stringcat| [test](blob/master/test/utils/stringcat.js) | Adds a value to the end of a string |

Using this helpers, the above example can be reduced to:

```js
        const {instance, trace, duration} = result;
        helper.push(result, `${instance}.${trace}`, duration);
```

The nested object will be created automatically for you.
