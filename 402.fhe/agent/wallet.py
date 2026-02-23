import os
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

load_dotenv()

def get_w3():
    return Web3(Web3.HTTPProvider(os.environ["SEPOLIA_RPC_URL"]))

def deposit(amount_usdc: int):
    w3 = get_w3()
    account = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])
    contract_addr = os.environ["CONTRACT_ADDRESS"]
    usdc_addr = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

    #  approve spending from agent wallet
    usdc_abi = [{"constant": False, "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "type": "function"}]
    usdc = w3.eth.contract(address=usdc_addr, abi=usdc_abi)
    
    tx = usdc.functions.approve(contract_addr, amount_usdc).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
    })
    
    signed = w3.eth.account.sign_transaction(tx, account.key)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    
    # deposit to marketplace
    contract_abi = [{"inputs": [{"name": "amount", "type": "uint64"}], "name": "deposit", "outputs": [], "stateMutability": "nonpayable", "type": "function"}]
    contract = w3.eth.contract(address=contract_addr, abi=contract_abi)
    
    tx = contract.functions.deposit(amount_usdc).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
    })
    
    signed = w3.eth.account.sign_transaction(tx, account.key)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    
    print(f"deposited {amount_usdc} USDC")

if __name__ == "__main__":
    deposit(5_000_000)
