//Poloniex Public API request
var returnTicker = new XMLHttpRequest();
var ticker;

returnTicker.open('GET', 'https://poloniex.com/public?command=returnTicker', true);
returnTicker.responseType = 'text';
returnTicker.send(null);

returnTicker.onload = function () {
  if (returnTicker.status === 200) {
    ticker = JSON.parse(returnTicker.responseText);
    console.log(ticker);
  }
};

var ajaxCalls = {
  bitcoinPriceRequest: function() {
    //Bitcoin Price Index request
    var returnBPI = new XMLHttpRequest();
    var coindesk;

    returnBPI.open('GET', 'http://api.coindesk.com/v1/bpi/currentprice.json', true);
    returnBPI.responseType = 'text';
    returnBPI.send(null);

    returnBPI.onload = function () {
      if (returnBPI.status === 200) {
        coindesk = JSON.parse(returnBPI.responseText);
        ajaxCalls.bitcoinPriceRequestDone = true;
        analysis.bitcoinPriceEUR = coindesk.bpi.EUR.rate_float;
        analysis.bitcoinPriceUSD = coindesk.bpi.USD.rate_float;
        console.log(coindesk);
      }
    };
  },
  //false for not done, true for success
  bitcoinPriceRequestDone: false,
  //function to get bitcoin price from a date before today
  //the "date" parameter can be: "year, month, day" of Number(date in MS)
  getHistoricalBPI: function(callback, date) {
    //new date object from the parameter
    var processedDate = new Date(date);
    //today's date object to compare both dates
    var today = new Date();

    //if input date is today or in the future, return current price per bitcoin
    if (processedDate.getDate() >= today.getDate() && processedDate.getMonth() >= today.getMonth() && processedDate.getFullYear() >= today.getFullYear()) {
      return coindesk.bpi.USD.rate_float;
    }

    //if input date is really in the past, do GET request
    var historicalBPI = new XMLHttpRequest();
    var historicalData;

    var day = "0" + processedDate.getDate();
    day = day.slice(-2);
    var month = "0" + (processedDate.getMonth() + 1);
    month = month.slice(-2);
    var coindeskDateString = processedDate.getFullYear() + "-" + month + "-" + day;

    var URL = "http://api.coindesk.com/v1/bpi/historical/close.json?start=" + coindeskDateString + "&end=" + coindeskDateString;

    historicalBPI.open("GET", URL, true);
    historicalBPI.responseType = 'text';
    historicalBPI.send(null);

    historicalBPI.onload = function () {
      if (historicalBPI.status === 200) {
        historicalData = JSON.parse(historicalBPI.responseText);
        console.log(historicalData);
        callback(historicalData);
      }
    };
  },
  //een test callback om de historicalBPI in de console te zetten
  historicalBPICallback: function(result) {
    console.log("HistoricalBPI opvragen is gelukt!");
    //hier inzetten wat er moet gebeuren als de AJAX request klaar is
  }
};

//object om alle transacties en berekeningen in te zetten
var analysis = {
  currencies: {},
  bitcoinPriceUSD: 0,
  bitcoinPriceEUR: 0
};

function Currency(name) {
  this.name = name;
  this.longName = "BTC_" + name;
  this.sell = new SellObject();
  this.buy = new BuyObject();
  
  Object.defineProperties(this, {
    "getSortedTransactions": {
      get: function() {
        let arr = [];
        this.sell.transactions.forEach(function(val, ind) {
        arr.push(val);
        });
        this.buy.transactions.forEach(function(val, ind) {
          arr.push(val);
        });
        //sorts all transactions with the newest first
        arr.sort(sortDateNewestFirst);
        return arr;
      },
      enumerable: true
    },
    "currentBalance": {
      get: function() {
        //get: currentBalance (buy:totalReceived - sell:totalSold)
        return this.buy.totalReceived - this.sell.totalSold;
      },
      enumerable: true
    },
    "currentBtcPerShare": {
      get: function() {
        return parseFloat(ticker[this.longName].last);
      },
      enumerable: true
    },
    "currentWinLoss": {
      get: function() {
        //get: currentWinLoss  (sell:totalBtcReceived - buy:totalBtcPaid)
            //maybe make this an object: {winLoss: 0.045656, positive: false}
            //so always positive number, with an additional variable for if it is pos/neg
        return this.sell.totalBtcReceived - this.buy.totalBtcPaid;
      },
      enumerable: true
    },
    "balanceBtcWorth": {
      get: function() {
        //get: balanceBtcWorth (currentBalance * currentBtcPerShare)
        return this.currentBalance * this.currentBtcPerShare;
      },
      enumerable: true
    },
    "totalBtcWorth": {
      get: function() {
        //get: totalBtcWorth (balanceBtcWorth + sell:totalBtcReceived)
        return this.balanceBtcWorth + this.sell.totalBtcReceived;
      },
      enumerable: true
    },
    "totalWinLoss": {
      get: function() {
        //get: totalWinLoss (totalBtcWorth - buy:totalBtcPaid)
        return this.totalBtcWorth - this.buy.totalBtcPaid;
      },
      enumerable: true
    },
    "breakEvenPrice": {
      get: function() {
        //get: breakEvenPrice (|totalWinLoss| / currentBalance)
        return (this.currentWinLoss * -1) / this.currentBalance;
      },
      enumerable: true
    },
    "totalChangePercentage": {
      get: function() {
        //get: totalChangePercentage (totalWinLoss / buy:totalBtcPaid) --> (* 100 for %)
        return this.totalWinLoss / this.buy.totalBtcPaid;
      },
      enumerable: true
    },
    "changeSinceLastBuy": {
      get: function() {
        //get: changeSinceLastBuy (currentBtcPerShare - lastBtcPerShare / lastBtcPerShare)
        return (this.currentBtcPerShare - this.buy.lastBtcPerShare) / this.buy.lastBtcPerShare;
      },
      enumerable: true
    },
    "changeSinceLastSell": {
      get: function() {
        //get: changeSinceLastSell (currentBtcPerShare - lastBtcPerShare / lastBtcPerShare)
        return (this.currentBtcPerShare - this.sell.lastBtcPerShare) / this.sell.lastBtcPerShare;
      },
      enumerable: true
    },
    "changeSinceLastTransaction": {
      get: function() {
        //get: changeSinceLastTransaction (if buy latest dateUTC > sell latest dateUTC
        let sortedArr = this.getSortedTransactions;
        let lastPrice = sortedArr[0].btcPerShare;
        return (this.currentBtcPerShare - lastPrice) / lastPrice;
      },
      enumerable: true
    },
    "currentInventoryStats": {
      get: function() {
        //get current balance
        //loop over transactions until current balance =< 0
        //if buy: totalBtcPaid += transaction btc paid
        //if buy: current balance - received from transaction
        //if sell: totalBtcPaid -= transaction btc received
        //if sell: current balance + amount sold in transaction
        
        //to compare with
        let balance = this.currentBalance;
        //to subtract from until lower than 0
        let runningTotalBalance = balance;
        
        //to keep track of total BTC spent
        let runningTotalBtc = 0;
        
        //newest first
        let transactionList = this.getSortedTransactions;
        
        //transform the type to 1 or -1 to multiply with
        /*transactionList.forEach(function(val) {
          if (val.type === "buy") {
            val.type = 1;
          } else if (val.type === "sell") {
            val.type = -1;
          }
        });*/
        
        //new array with corrections
        let mapBalance = balance;
        let newList = transactionList.map(function(val, ind) {
          //new object includes:
            //transaction amount received/sold
            //transaction btc paid/received
          
          let returnObj = {};
          if (val.type === "buy") {
            returnObj.curReceived = val.currencyReceived;
            returnObj.btcPaid = val.btcPaid;
          } else if (val.type === "sell") {
            returnObj.curReceived = (val.amount * -1);
            returnObj.btcPaid = (val.btcReceived * -1);
          }
          
          if (mapBalance <= 0) {
            //dan hoeft deze eigenlijk niet meegerekend te worden
            returnObj.mult = 0;
          } else if (mapBalance > 0) {
              if (mapBalance - returnObj.curReceived < 0) {
                //dan moet de multiplier voor deze aangepast worden
                returnObj.mult = mapBalance / returnObj.curReceived;
                mapBalance -= returnObj.curReceived;
            } else {
              returnObj.mult = 1;
              mapBalance -= returnObj.curReceived;
            }
          }
          return returnObj;
          //dit return object heeft:
            //curReceived: pos for buy, neg for sell
            //btcPaid: pos for buy, neg for sell
            //mult: 1 behalve als balance onder 0 zou komen
              //als balance al onder 0 is is mult 0
        });
        
      
        
        newList.forEach(function(val) {
          runningTotalBalance -= (val.curReceived * val.mult);
          runningTotalBtc += (val.btcPaid * val.mult);
        });
        
        return {finalBalance: runningTotalBalance, finalBtcCost: runningTotalBtc, currentBalanceSharePrice: (runningTotalBtc / this.currentBalance)};
        
      },
      enumerable: true
    },
    "currentBalanceSharePrice": {
      get: function() {
        //get: changeSinceLastTransaction (if buy latest dateUTC > sell latest dateUTC
        let arr = this.currentInventoryStats;
        if (arr.finalBalance < -0.00001 || arr.finalBalance > 0.00001) {
          return "Error";
        } else {
          return arr.currentBalanceSharePrice;
        }
      },
      enumerable: true
    },
  });  
  analysis.currencies[name] = this;
}

function sortDateNewestLast(a, b) {
  return a.dateUTC - b.dateUTC;
}

function sortDateNewestFirst(a, b) {
  return b.dateUTC - a.dateUTC;
}

function BuyObject() {
  this.transactions = [];
  
  Object.defineProperties(this, {
    "averageBuyPrice": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
            sum += val.btcPerShare;
        });
        return sum / this.transactions.length;
      }
    },
    "averageBuyPricePerCoin": {
      get: function() {
        return this.totalBtcPaid / this.totalReceived;
      }
    },
    "totalBought": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
            sum += val.amount;
        });
        return sum;
      }
    },
    "totalReceived": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
          sum += val.fee;
        });
        return this.totalBought - sum;
      }
    },
    "totalBtcPaid": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
          sum += val.btcPaid;
        });
        return sum;
      }
    },
    "lastBtcPerShare": {
      get: function() {
        let arr = this.transactions.sort(sortDateNewestFirst);
        return arr[0].btcPerShare;
      }
    }
  });
}

function SellObject() {
  this.transactions = [];

  Object.defineProperties(this, {
    "averageSellPrice": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
            sum += val.btcPerShare;
        });
        return sum / this.transactions.length;
      }
    },
    "averageSellPricePerCoin": {
      get: function() {
        return this.totalBtcReceived / this.totalSold;
      }
    },
    "totalSold": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
            sum += val.amount;
        });
        return sum;
      }
    },
    "totalBtcReceived": {
      get: function() {
        let sum = 0;
        this.transactions.forEach(function(val) {
          sum += val.btcReceived;
        });
        return sum;
      }
    },
    "lastBtcPerShare": {
      get: function() {
        let arr = this.transactions.sort(sortDateNewestFirst);
        return arr[0].btcPerShare;
      }
    }
  });
}

function Transaction(buyOrSell, currency, btcPerShare, amount, fee, dateUTC) {
  buyOrSell = (buyOrSell.toLowerCase() === "buy" || buyOrSell.toLowerCase() === "sell") ? buyOrSell.toLowerCase() : "UNDEFINED";
  
  currency = currency.toUpperCase();
  
  if (!(currency in analysis.currencies)) {
    new Currency(currency);
  }
  
  currency = currency.toUpperCase();
  
  this.btcPerShare = btcPerShare;
  this.amount = amount;
  this.fee = fee;
  this.dateUTC = new Date(dateUTC);
  
  if (buyOrSell === "buy") {
    this.btcPaid = this.btcPerShare * this.amount;
    this.currencyReceived = this.amount - this.fee;
    this.type = "buy";
  } else if (buyOrSell === "sell") {
    this.btcReceived = (this.btcPerShare * this.amount) - this.fee;
    this.type = "sell";
  }
  
  analysis.currencies[currency][buyOrSell].transactions.push(this);
}

/*
+currency
  +buy
    +transactions
      +btcPerShare
      +amountBought
      +feePaid
      +dateUTC
      +btcPaid (btcPerShare * amountBought)
    +get: averageBuyPrice (gemiddelde alle btcPerShare prijzen)
    +get: averageBuyPricePerCoin (includes fees) (totalBtcPaid / totalReceived)
    +get: totalBought (amountBought sum)
    +get: totalReceived (totalBought - sum of feePaid)
    +get: totalBtcPaid (sum of btcPaid)
    +get: lastBtcPerShare (for latest dateUTC = max; btcPerShare)
      
  +sell
    +transactions
      +btcPerShare
      +amountSold
      +feePaid
      +dateUTC
      +btcReceived ((btcPerShare * amountSold) - feePaid
    +get: averageSellPrice (gemiddelde alle btcPerShare prijzen)
    +get: averageSellPricePerCoin (includes fees) (totalBtcReceived / totalSold)
    +get: totalSold (sum amountSold)
    +get: totalBtcReceived (sum btcReceived)
    +get: lastBtcPerShare (for latest dateUTC = max; btcPerShare)
  
  +get: currentBalance (buy:totalReceived - sell:totalSold)
  +get: currentBtcPerShare (get from poloniex AJAX request)
  +get: currentWinLoss  (sell:totalBtcReceived - buy:totalBtcPaid)
  +get: balanceBtcWorth (currentBalance * currentBtcPerShare)
  +get: totalBtcWorth (balanceBtcWorth + sell:totalBtcReceived)
  +get: totalWinLoss (totalBtcWorth - buy:totalBtcPaid)
  +get: breakEvenPrice (|totalWinLoss| / currentBalance)
  +get: totalChangePercentage (totalWinLoss / buy:totalBtcPaid) --> (* 100 for %)
  +get: changeSinceLastBuy (currentBtcPerShare - lastBtcPerShare / lastBtcPerShare) ---> (* 100 for %)
  +get: changeSinceLastSell (currentBtcPerShare - lastBtcPerShare / lastBtcPerShare) ---> (* 100 for %)
  +get: changeSinceLastTransaction (if buy latest dateUTC > sell latest dateUTC --> buy:changeSinceLast)
      
*/