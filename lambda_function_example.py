# Example of how to update your Lambda function to call Vercel API
# Replace the call_vercel function and update the intent handlers

import os
import urllib.request
import json

# Get Vercel URL from environment variable (set in Lambda configuration)
VERCEL_API_URL = os.environ.get('VERCEL_API_URL', 'https://your-app.vercel.app')
ALEXA_SHARED_SECRET = os.environ.get('ALEXA_SHARED_SECRET')

def call_vercel_api(endpoint, data):
    """Call Vercel API endpoint with authentication"""
    url = f"{VERCEL_API_URL}/api/alexa/{endpoint}"
    body = json.dumps(data).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-mirror-secret": ALEXA_SHARED_SECRET
        },
        method="POST"
    )
    
    try:
        response = urllib.request.urlopen(req)
        return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        logger.error(f"API call failed: {e.code} - {error_body}")
        raise

# Updated AddTodoIntentHandler example:
class AddTodoIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("AddTodoIntent")(handler_input)

    def handle(self, handler_input):
        item = handler_input.request_envelope.request.intent.slots["todoItem"].value

        try:
            # Call Vercel API
            call_vercel_api("todo/add", {"text": item})
            speech_text = f"Added {item} to your list."
        except Exception as e:
            logger.error(f"Failed to add todo: {e}")
            speech_text = f"Sorry, I couldn't add {item} to your list."

        handler_input.response_builder.speak(speech_text).set_card(
            SimpleCard("To Do", speech_text)
        )
        return handler_input.response_builder.response

# Updated RemoveTodoIntentHandler example:
class RemoveTodoIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("RemoveTodoIntent")(handler_input)

    def handle(self, handler_input):
        item = handler_input.request_envelope.request.intent.slots["todoItem"].value

        try:
            call_vercel_api("todo/remove", {"text": item})
            speech_text = f"Removed {item} from your list."
        except Exception as e:
            logger.error(f"Failed to remove todo: {e}")
            speech_text = f"Sorry, I couldn't remove {item} from your list."

        handler_input.response_builder.speak(speech_text)
        return handler_input.response_builder.response

# Updated CompleteTodoIntentHandler example:
class CompleteTodoIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("CompleteTodoIntent")(handler_input)

    def handle(self, handler_input):
        item = handler_input.request_envelope.request.intent.slots["todoItem"].value

        try:
            call_vercel_api("todo/complete", {"text": item, "completed": True})
            speech_text = f"Marked {item} as completed."
        except Exception as e:
            logger.error(f"Failed to complete todo: {e}")
            speech_text = f"Sorry, I couldn't mark {item} as completed."

        handler_input.response_builder.speak(speech_text)
        return handler_input.response_builder.response

# Updated ReminderIntentHandler example:
class ReminderIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("ReminderIntent")(handler_input)

    def handle(self, handler_input):
        task = handler_input.request_envelope.request.intent.slots["task"].value

        try:
            # Extract reminder details using Bedrock Agent
            response = extract_reminder_fields(task, session_id=str(uuid.uuid4()))
            text = read_agent_text(response)
            json_str = extract_json_object(text)
            reminder_data = json.loads(json_str)
            
            logger.info(f"Extracted reminder data: {reminder_data}")
            
            # Call Vercel API with extracted data
            call_vercel_api("event/add", {
                "task": reminder_data.get("task"),
                "date": reminder_data.get("date"),
                "time": reminder_data.get("time")
            })
            
            speech_text = f"Reminder set for {task}."
        except Exception as e:
            logger.error(f"Failed to set reminder: {e}")
            speech_text = f"Sorry, I couldn't set the reminder for {task}."

        handler_input.response_builder.speak(speech_text)
        return handler_input.response_builder.response
