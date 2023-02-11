## IMPORTANT NOTES BEFORE RUNNING THE BOT

1) The bot uses a wallet address and private key - this needs to be the **FIRST ACCOUNT** (Account0 by default) that was created by default when you installed metamask on your pc / macbook. 
    - if this is **NOT** configured correctly you will get an error that says "(node:45320) UnhandledPromiseRejectionWarning: Error: insufficient funds for intrinsic transaction cost"

2) Make **sure** you have the following assets in your MetaMask wallet **FOR THE ACCOUNT ADDRESS WITH WHICH YOU ARE USING THE BOT**
    - BNB (this is needed for gas and used to purchase the desired token)
    - IF you want to TEST the bot using BNB / BUSD, then ADD the BUSD custom token to your MetaMask (0xe9e7cea3dedca5984780bafc599bd69add087d56)
    - Run the bot using the to_Purchase value of the BUSD token contract. This works because liquidity is frequently added to this pool.

## BOT SETUP & CONFIGURATION INSTRUCTIONS

1) Download & Install Node.js - https://nodejs.org/en/ - 14.16.1 LTS is fine

2) Extract the bot zip / download contents to a folder, example C:\users\username\Downloads\pancakeswap-sniping-bot\

3) open index.html and input:[can omit this step ( can use UI to set this setting)]
    - your wallet address on line 87
    - the private key of your wallet on line 88
    - the Http node URL you want to use on line 89
    - the WSS  node URL you want to use on line 90
    - the contract address of the token you want to purchase on line 91
        you can use BUSD as an example, as the WBNB / BUSD liquidity pool gets additions every few minutes    
    - the amount of WBNB of the token you want to purchase on line 92
    - the slippage required to purchase the token on pancakeswap on line 93
        - you will need to MAKE SURE the slippage is set correctly for each token you plan to purchase
    - the gas Price of the transaction you want to make on line 94
    - the gas Limit of the transaction you want to make on line 95
    - the Sell price of the transaction you want to make on line 96



4) Run the bot
    - open the command prompt (it should be in the same directory it was earlier when you issued node commands)
    - type 'npm start' and hit ENTER to run the bot
    - you should see the bot listening for liquidity addition to pancakeswap in your command prompt window

### Donations
Donations are appreciated if you make a nice profit off the bot. :)
ETH, ERC20, **BSC** BNB & BEP20 tokens: 0xCf1d544C1827F653652e34beCf748bBEE58BC1E2
