
import os
import firebase_admin
from firebase_admin import credentials
from firebase_admin import db

# IMPORTANT: Set the environment variable 'GOOGLE_APPLICATION_CREDENTIALS' to the path of your service account key file.
# For example, in your terminal:
# export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"

# Fetch the service account key file path from the environment variable.
# You need to download this file from your Firebase project settings.
try:
    # Initialize the app with a service account, granting admin privileges
    firebase_admin.initialize_app({
        'databaseURL': 'https://cashflow-e8354-default-rtdb.europe-west1.firebasedatabase.app/'
    })
except ValueError as e:
    print("Error initializing Firebase. Please make sure you have set the GOOGLE_APPLICATION_CREDENTIALS environment variable.")
    print("For example: export GOOGLE_APPLICATION_CREDENTIALS='/Users/martinsauer/Workspace/cashflow/src/cashflow-e8354-firebase-adminsdk-fbsvc-af14d8ae4b.json'")
    exit()


# Get a reference to the database service
ref = db.reference('transactions')

# Retrieve the last 10 transactions, ordered by timestamp
# This assumes your transactions are stored under a 'transactions' node
# and each transaction has a 'timestamp' field.
latest_transactions = ref.order_by_child('timestamp').limit_to_last(10).get()

if latest_transactions:
    # The result is a dictionary, convert it to a list of transactions
    transaction_list = list(latest_transactions.values())
    
    # Sort by timestamp in descending order to show the newest first
    transaction_list.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

    print("Last 10 transactions:")
    for transaction in transaction_list:
        print(f"- {transaction.get('date')}: {transaction.get('description')} ({transaction.get('amount')} EUR)")
else:
    print("No transactions found.")

