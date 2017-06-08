var inputJSONBtn = document.getElementById("inputJSONBtn");
inputJSONBtn.addEventListener("click", processTradeHistory);

function processTradeHistory() {
  let input = document.getElementById("inputJSON").value;
  let inputEncoded = encodeURI(input);
  let inputEncodedRows = inputEncoded.split("%0A");
  let inputEncodedRowsItems = [];
  inputEncodedRows.forEach(function (thing) {
    inputEncodedRowsItems.push(thing.split("%09"));
  });
  console.log(inputEncodedRowsItems);
  processInputRow(inputEncodedRowsItems);
  generateTradedCurrenciesList();
}

function processInputRow(arr) {
  arr.forEach(function (cur) {
    let currencyRE = /^([A-Z]{2,5})/;
    let currency = (cur[0].match(currencyRE))[0];
    let sharePrice = cur[3];
    let amount = cur[4];
    let feeRE = /([^\s]+)/;
    let fee = decodeURI(cur[5]).match(feeRE)[0];
    let type = cur[1].toLowerCase();
    let newDate = decodeURI(cur[7]);
    console.log(type, currency, sharePrice, amount, fee, newDate);

    new Transaction(type, currency, parseFloat(sharePrice), parseFloat(amount), parseFloat(fee), newDate);
  });
}

var tradedCurrenciesList = document.getElementById("tradedCurrenciesList");
//<li class="list-group-item">Cras justo odio</li>
function generateTradedCurrenciesList() {
  let currenciesTable = document.getElementById("currenciesTable").getElementsByTagName("tbody")[0];
  
  let arrTable = [];
  
  for (let cur in analysis.currencies) {
    let arr = analysis.currencies[cur];
    let arrRow = [];
    arrRow.push(arr.name, (arr.currentBalance).toFixed(8), (arr.changeSinceLastTransaction*100).toFixed(2) + "%", "UNDEF");
    
    if (arrRow[1] > -0.00000004 && arrRow[1] < 0.00000004) {
      arrRow[1] = "0";
    }
    
    arrTable.push(arrRow);
  }
  
  arrTable.forEach(function(row, ind) {
    let newRow = currenciesTable.insertRow();
    
    if (arrTable[ind][1] === "0") {
      newRow.className = "zeroBalance";
    } else if ((arrTable[ind][2]).slice(0,-1) > 0) {
      newRow.className = "success";
    } else if ((arrTable[ind][2]).slice(0,-1) < 0) {
      newRow.className = "danger";
    }
    
    row.forEach(function(col) {
      let cell = newRow.insertCell();
      let text = document.createTextNode(col);
      cell.appendChild(text);
    });
    
  });
}

var toggleZero = document.getElementById("toggleZero");
toggleZero.addEventListener("click", toggleZeroFn);

function toggleZeroFn() {
  var zeros = document.querySelectorAll("tbody .zeroBalance");
  if (toggleZero.checked) {
    zeros.forEach(function(cur) {
      cur.style.display = "none";
    });
  } else if (!toggleZero.checked) {
    zeros.forEach(function(cur) {
      cur.style.display = "table-row";
    });
  }
}

function toggleChevron(e) {
    $(e.target)
        .prev('.panel-heading')
        .find('i.indicator')
        .toggleClass('glyphicon-chevron-down glyphicon-chevron-up');
}
$('#collapsable').on('hide.bs.collapse', toggleChevron);
$('#collapsable').on('show.bs.collapse', toggleChevron);