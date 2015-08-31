# node-shmdoc
Simple tool to analyze data in order to support documenting some ad hoc "schema" of available information-elements.

# Usage and Setup
The simple steps to get you enjoying this.

## 00. Assumption
> The data at hand is worth your time

You have a bunch of data that is worth being exchanged: people are willing to maintain, others are eager to do stuff with it.

Some of those actually have a clue about what the data suposedly means, and can be motivated to help augment any systematic description a robot already found out about it.

## 01. Side 1. Robot.
> Automatic Data Analyzer

One side of the shmdoc project is an automated process (robot) that analyzes any data presented to it to produce a basis for further documentation.

From the actual data, this system will primarily list all the various information elements found in the data, and where to find it 

To let the robot do his work, you simply need to 
* install [nodejs](http://nodejs.org), 
* checkout this project and run
```npm install```
* then use the tool with a command like ```node index.js datafiles*.json -r path/to/write/result.json```

You would typically set this up on a server that through some schedule job (cron) 

1. downloads the data
1. feeds the data to the robot
1. makes the result.json of the robot available via a web-server to the next step

## 02. Side 2. Humans.
> Manually Adding Human Insight (aka Documenting)

```shmdoc``` choose using simply the Google Spreadsheets product to allow both further documenting and immediately publishing the documentation about the data.

To use it, you create a [new Google Spreadsheet]() and add the [shmdoc addon](https://chrome.google.com/webstore/detail/naaomibecanamichicadcgokdmhelkfo/) from the addon - marketplace.

The code for the project is available at github, and published from this [apps-project](https://script.google.com/d/1Yly5JI6v0j-tTycypiaoJPniuyFSG4d_y7Js0ZbGBxHAm240Pcx0v28O/edit?usp=sharing)


## 03. Repeat. 
> Roundtrip the process to effectively maintain the documentation and assert the ```shmdoc```

The good thing is that, the human augmented information in the google-spreadsheet can now be fed back into the robot (step 1)

Doing this will make the robot still do his earlier job (i.e. learn about possible new fields), but additionally it will now check and assert the human undersigned version of the ```shmdoc``` coming from the google-spreadsheet. In doing so, it will list any found value-errors it occured in the (possibly newer datasets).

The easiest way to close this loop is to 

1. publish the shmdoc-spreadsheet as csv straight from google-docs
1. feed that published uri back into the robot with the ```-b <<uri>>``` switch.

The google-spreadsheet-uri should typically follow this pattern: ```https://docs.google.com/spreadsheets/d/{doc_id}/pub?gid={tab_id}&single=true&output=csv```


If all is well, you have succesfully setup this cycle:

![shmdoc process cycle](https://docs.google.com/drawings/d/10nZSkuqpUKRFRUXo1X237ZQHdZW8kbXLY8uSWQgYBUw/pub?w=960&h=720)

# Known limitations

* The robot currently only reads samples in json, xml and csv. We're open for additions that support more.
* More [suggestions](https://github.com/westtoer/node-shmdoc/issues) and [patches](https://github.com/westtoer/node-shmdoc/pulls) are welcome.

# wtf? // why this froject

## background

My personal, somewhat related, and almost relavant experience in this space can be summed up as coming from these random events:

### cs // computer-science

During an ancient classical typed versus untyped language debate a wise man once told me 
> "Nobody (really) is interested in the types, only in the values".

### rl // real life

The common knowledge among friends regarding Ikea furniture is 
> "Manuals (any documentation) are for sissies".

## gist

There.
You can twist the above in a number of ways, so feel free :)

Here is my read: When faced with (real) people exchanging data through some formal mechanism I see them quickly agreeing on some serialization format (xml, json, csv) - but never taking the time to actually list or describe the information-elements being communicated, nor checking if their claims about the nature of the values really can be asserted.

And later, when the Master Engineering Peeps emerge from their Ivory Towers up in the Sky (gotta love the view) and see the Silly Dilettantes failing to bootstrap even the simpelest interchange... they mostly end up removing any remaining enthousiasm and motivation by insisting upon a full blown **Schema**.  Ouch.

Having seen many of those without even the most basic shred of comments or explanations, let alone semantics I've come to realise that once again this is about human communication, and not about technical wizardry.  Far more often then a schema the project would benefit from a (maintained) simple documentation of all available information.

What shmdoc does is just make sure people get to analyze real data (what they are interested in) and describe in the most intuitive and pragmatic way what it means for them.

## the rose

The name is pronounced ```sjiemdoc``` (&#643;&#105;&#109;'&#100;&#596;&#107;). And spelled all lowercase ```shmdoc```.

It was meant as a play on 'only the gist (no vowels) of the schema' + plus a 'focus on getting it documented' by a group of people.

## letting the geek loose 

The data-structures produced by the shmdoc robot and maintained in the spreadsheet do NOT strictly follow an explicit schema.

Why bother? Since, you can simply consult the [shmdoc on shmdoc](https://docs.google.com/spreadsheets/d/1jwqExbm4tOmwHxSVaX_6nRIeEscitQvbaeuZAMHSlzI)!