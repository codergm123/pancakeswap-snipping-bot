import http from 'http'
import ethers from 'ethers'
import express from 'express'
import expressWs from 'express-ws'
import fs from 'fs'
import chalk from 'chalk'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const httpServer = http.createServer(app)
const wss = expressWs(app, httpServer)

const data = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',     // WBNB Address
  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2 factory
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 router
}

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: 'success', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: 'supply', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: 'success', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: 'digits', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: 'success', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: '_owner', type: 'address' },
      { indexed: true, name: '_spender', type: 'address' },
      { indexed: false, name: '_value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
]

var botStatus = false
var isStarted = false
var isBuy = false
var isSell = false
var lockedList = []
var priceList = []

/*****************************************************************************************************
 * Set Bot status consisting of wallet address, private key, token address, slippage, gas price, etc.
 * ***************************************************************************************************/
function setBotStatus(obj) {
  console.log('--- bot status', obj.botStatus)
  if (obj.botStatus) {
    botStatus = obj.botStatus
    data.recipient = obj.walletAddr
    data.privateKey = obj.privateKey
    data.tokenAddress = obj.tokenAddress
    data.AMOUNT_OF_WBNB = exponentialToDecimal(obj.inAmount)
    data.Slippage = obj.slippage
    data.gasPrice = obj.gasPrice
    data.gasLimit = obj.gasLimit
    data.nodeURL = obj.nodeURL
    data.wssURL = obj.wssURL
    data.profit = obj.profit
  }
  console.log(data)
}

/*****************************************************************************************************
 * Get the message from the frontend and analyze that, start mempool scan or stop.
 * ***************************************************************************************************/
app.ws('/connect', function (ws, req) {
  ws.on('message', async function (msg) {
    if (msg === 'connectRequest') {
      var obj = { botStatus: botStatus }
      ws.send(JSON.stringify(obj))
    } else {
      var obj = JSON.parse(msg)
      setBotStatus(obj)
      botStatus = obj.botStatus
      if (botStatus && !isStarted) {
        isStarted = true
        scanMempool()
        setInterval(sell, 15000)
      }
    }
  })
})

var txData
var txFunc
var lpAddress

/*****************************************************************************************************
 * Find the new liquidity Pair with specific token while scanning the mempool in real-time.
 * ***************************************************************************************************/
const scanMempool = async () => {
  const provider = new ethers.providers.JsonRpcProvider(data.nodeURL)
  var customWsProvider = new ethers.providers.WebSocketProvider(data.wssURL)
  var wallet = new ethers.Wallet(data.privateKey)
  const account = wallet.connect(provider)
  const router = new ethers.Contract(
    data.router,
    [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
    ],
    account,
  )

  try {
    console.log(
      chalk.red(`\nStart New Liqudity Pair added detect Service Start ... `),
    )
    customWsProvider.on('pending', (tx) => {
      if (botStatus === true && isBuy === false) {
        customWsProvider.getTransaction(tx).then(async function (transaction) {
          // try {

          if (transaction != null) {
            try {
              txData = transaction.data
              txFunc = txData.substring(0, 10)
              lpAddress = '0x' + txData.substring(10, 74).replace(/^0+/, '')
              // console.log(transaction.hash);
              if (
                (txFunc == '0xf305d719' || txFunc == '0xe8e33700') &&
                data.tokenAddress.toLowerCase() == lpAddress.toLowerCase()
              ) {
                console.log(
                  chalk.red(`New Add liquidity address :  ${lpAddress}`),
                )
                console.log(
                  '------------------------ Add Liqudity transaction Hash : ',
                  transaction.hash,
                )

                isBuy = true
                const tokenIn = data.WBNB
                const tokenOut = ethers.utils.getAddress(lpAddress)

                //We buy x amount of the new token for our wbnb
                const amountIn = ethers.utils.parseUnits(
                  `${data.AMOUNT_OF_WBNB}`,
                  'ether',
                )
                console.log(amountIn, data.WBNB, tokenOut)
                const amounts = await router.getAmountsOut(amountIn, [
                  tokenIn,
                  tokenOut,
                ])

                //Our execution price will be a bit different, we need some flexbility
                const amountOutMin = amounts[1].sub(
                  amounts[1].mul(`${data.Slippage}`).div(100),
                )
                //const amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`));
                console.log('slippage', amountOutMin, amounts[1])

                console.log(
                  chalk.green.inverse(`Liquidity Addition Detected\n`) +
                    `Buying Token
                    =================
                    tokenIn: ${amountIn.toString()} ${tokenIn} (WBNB)
                    tokenOut: ${amountOutMin.toString()} ${tokenOut}
                  `,
                )

                let price = amountIn / amounts[1]
                lockedList[0] = tokenOut
                priceList[0] = price
                
                //Buy token via pancakeswap v2 router.
                const buy_tx = await router
                  .swapExactETHForTokens(
                    amountOutMin,
                    [tokenIn, tokenOut],
                    data.recipient,
                    Date.now() + 1000 * 60 * 10, //10 minutes
                    {
                      gasLimit: data.gasLimit,
                      gasPrice: ethers.utils.parseUnits(
                        `${data.gasPrice}`,
                        'gwei',
                      ),
                      value: amountIn,
                    },
                  )
                  .catch((err) => {
                    console.log(err)
                    console.log('transaction failed...')
                  })

                // await buy_tx.wait();
                let receipt = null
                while (receipt === null) {
                  try {
                    receipt = await provider.getTransactionReceipt(buy_tx.hash)
                  } catch (e) {
                    console.log(e)
                  }
                }

                // append buy history into log.txt
                fs.appendFile(
                  'log.txt',
                  new Date().toISOString() +
                    ': Preparing to buy token ' +
                    tokenIn +
                    ' ' +
                    amountIn +
                    ' ' +
                    tokenOut +
                    ' ' +
                    amountOutMin +
                    '\n',
                  function (err) {
                    if (err) throw err
                  },
                )

                fs.appendFile(
                  'tokenlist.txt',
                  '\n' + tokenOut + ' ' + price,
                  function (err) {
                    if (err) throw err
                  },
                )
                
                // Send the response to the frontend so let the frontend display the event.
                var aWss = wss.getWss('/')
                aWss.clients.forEach(function (client) {
                  var detectObj = {
                    token: tokenOut,
                    action: 'Detected',
                    price: price,
                    transaction: transaction.hash,
                  }
                  var detectInfo = JSON.stringify(detectObj)
                  client.send(detectInfo)
                  var obj = {
                    token: tokenOut,
                    action: 'Buy',
                    price: price,
                    transaction: buy_tx.hash,
                  }
                  var updateInfo = JSON.stringify(obj)
                  client.send(updateInfo)
                })
              }
            } catch (err) {
              isBuy = false
              console.log(err)
              console.log('transaction ....')
            }
          }
        })
      }
    })
  } catch (err) {
    console.log(
      'Please check the network status... maybe its due because too many scan requests..',
    )
    scanMempool()
  }
}
/*****************************************************************************************************
 * Sell the token when the token price reaches a setting price.
 * ***************************************************************************************************/
const sell = async () => {
  if (botStatus && !isSell) {
    const provider = new ethers.providers.JsonRpcProvider(data.nodeURL)
    var customWsProvider = new ethers.providers.WebSocketProvider(data.wssURL)
    var wallet = new ethers.Wallet(data.privateKey)
    const account = wallet.connect(provider)
    const router = new ethers.Contract(
      data.router,
      [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
      ],
      account,
    )

    try {
      if (lockedList.length < 1) return
      const tokenIn = lockedList[0]
      const tokenOut = data.WBNB
      const contract = new ethers.Contract(tokenIn, ERC20_ABI, account)
      //We buy x amount of the new token for our wbnb
      const amountIn = await contract.balanceOf(data.recipient)
      const decimal = await contract.decimals()
      // console.log("sell amount" + amountIn);
      if (amountIn < 1) return
      console.log('amoutIn...', amountIn)
      const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut])
      //Our execution price will be a bit different, we need some flexbility
      const amountOutMin = amounts[1].sub(
        amounts[1].mul(`${data.Slippage}`).div(100),
      )

      // check if the specific token already approves, then approve that token if not.
      let amount = await contract.allowance(data.recipient, data.router)
      if (
        amount <
        115792089237316195423570985008687907853269984665640564039457584007913129639935
      ) {
        await contract.approve(
          data.router,
          ethers.BigNumber.from(
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          ),
          { gasLimit: 100000, gasPrice: 5e9 },
        )
        console.log(tokenIn, ' Approved \n')
      }

      // let price = (amountOutMin/amountIn)/Math.pow(10, 18-decimal);
      let price = amounts[1] / amountIn
      let sellPrice = (data.profit / 100) * parseFloat(priceList[0])
      fs.appendFile(
        'log.txt',
        new Date().toISOString() +
          ': Preparing to sell token ' +
          tokenIn +
          ' ' +
          amountIn +
          ' ' +
          tokenOut +
          ' ' +
          amountOutMin +
          '\n',
        function (err) {
          if (err) throw err
        },
      )

      if (price > sellPrice) {
        isSell = true
        console.log(
          chalk.green.inverse(`\nSell tokens: \n`) +
            `================= ${tokenIn} ===============`,
        )
        console.log(chalk.yellow(`decimals: ${decimal}`))
        console.log(chalk.yellow(`price: ${price}`))
        console.log(chalk.yellow(`sellPrice: ${sellPrice}`))
        console.log('')

        // sell the token via pancakeswap v2 router
        const tx_sell = await router
          .swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            0,
            [tokenIn, tokenOut],
            data.recipient,
            Date.now() + 1000 * 60 * 10, //10 minutes
            {
              gasLimit: data.gasLimit,
              gasPrice: ethers.utils.parseUnits(`10`, 'gwei'),
            },
          )
          .catch((err) => {
            console.log('transaction failed...')
            isSell = false
          })

        // await tx_sell.wait();
        let receipt = null
        while (receipt === null) {
          try {
            receipt = await provider.getTransactionReceipt(tx_sell.hash)
          } catch (e) {
            console.log(e)
          }
        }
        console.log('Token is sold successfully...')
        var aWss = wss.getWss('/')
        aWss.clients.forEach(function (client) {
          var obj = {
            token: tokenIn,
            action: 'Sell',
            price: price,
            transaction: tx_sell.hash,
          }
          var updateInfo = JSON.stringify(obj)
          client.send(updateInfo)
        })
        fs.appendFile(
          'log.txt',
          new Date().toISOString() +
            ': Sell token ' +
            tokenIn +
            ' ' +
            amountIn +
            ' ' +
            tokenOut +
            ' ' +
            amountOutMin +
            '\n',
          function (err) {
            if (err) throw err
          },
        )
      }
    } catch (err) {
      console.log(err)
      console.log(
        'Please check token BNB/WBNB balance in the pancakeswap, maybe its due because insufficient balance ',
      )
    }
  }
}
/*****************************************************************************************************
 * Convert exponential to Decimal. (e-3 - > 0.0001)
 * ***************************************************************************************************/
const exponentialToDecimal = (exponential) => {
  let decimal = exponential.toString().toLowerCase()
  if (decimal.includes('e+')) {
    const exponentialSplitted = decimal.split('e+')
    let postfix = ''
    for (
      let i = 0;
      i <
      +exponentialSplitted[1] -
        (exponentialSplitted[0].includes('.')
          ? exponentialSplitted[0].split('.')[1].length
          : 0);
      i++
    ) {
      postfix += '0'
    }
    const addCommas = (text) => {
      let j = 3
      let textLength = text.length
      while (j < textLength) {
        text = `${text.slice(0, textLength - j)},${text.slice(
          textLength - j,
          textLength,
        )}`
        textLength++
        j += 3 + 1
      }
      return text
    }
    decimal = addCommas(exponentialSplitted[0].replace('.', '') + postfix)
  }
  if (decimal.toLowerCase().includes('e-')) {
    const exponentialSplitted = decimal.split('e-')
    let prefix = '0.'
    for (let i = 0; i < +exponentialSplitted[1] - 1; i++) {
      prefix += '0'
    }
    decimal = prefix + exponentialSplitted[0].replace('.', '')
  }
  return decimal
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/index.html'))
})
const PORT = 9999

httpServer.listen(PORT, console.log(chalk.yellow(`Start Snipping bot...`)))
