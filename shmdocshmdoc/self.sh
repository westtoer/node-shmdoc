#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
NOCYG="$( which cygpath >> /dev/null && echo $?)";

shmdoc_csv_addon="https://docs.google.com/spreadsheets/d/1jwqExbm4tOmwHxSVaX_6nRIeEscitQvbaeuZAMHSlzI/pub?gid=0&single=true&output=csv"
shmdoc_csv_report="https://docs.google.com/spreadsheets/d/1jwqExbm4tOmwHxSVaX_6nRIeEscitQvbaeuZAMHSlzI/pub?gid=1390895958&single=true&output=csv"

node_shmdoc="${DIR}/../index.js";

shmdoc_json_addon="${DIR}/addon-shmdoc-report.json";
shmdoc_json_report="${DIR}/report-shmdoc-report.json";

shmdoc_data_json="${DIR}/*.json";
shmdoc_data_csv="${DIR}/*.csv";

if [ "${NOCYG}" -eq "0" ]; then
  node_shmdoc="$(cygpath -w ${node_shmdoc})";
  shmdoc_json_addon="$(cygpath -w ${shmdoc_json_addon})";
  shmdoc_json_report="$(cygpath -w ${shmdoc_json_report})";
  shmdoc_data_json="$(cygpath -w ${shmdoc_data_json})";
  shmdoc_data_csv="$(cygpath -w ${shmdoc_data_csv})";
fi

#download example data

curl --url "${shmdoc_csv_addon}"  -s -o ${DIR}/addon-shmdoc.csv
curl --url "${shmdoc_csv_report}" -s -o ${DIR}/report-shmdoc.csv

#run the shmdocs for these csv
echo "analysing csv"
node ${node_shmdoc} -b "${shmdoc_csv_addon}" -r ${shmdoc_json_addon} ${shmdoc_data_csv}

#run the shmdocs for the shmdocs to be used in to update the csv
echo "analysing json"
node ${node_shmdoc} -b "${shmdoc_csv_report}" -r ${shmdoc_json_report} ${shmdoc_data_json}
