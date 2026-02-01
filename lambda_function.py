import logging
import json
import urllib.request
from ask_sdk_core.skill_builder import SkillBuilder
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.dispatch_components import AbstractExceptionHandler
from ask_sdk_core.utils import is_request_type, is_intent_name
from ask_sdk_core.handler_input import HandlerInput

from ask_sdk_model.ui import SimpleCard
from ask_sdk_model import Response
import boto3
import json
import re
import uuid

bedrock = boto3.client("bedrock-agent-runtime", region_name="us-east-1")

AGENT_ID = "DWFOFSX0S9"
AGENT_ALIAS_ID = "RNNI7PYCRK"

VERCEL_API_URL = "https://your-vercel-app.vercel.app/api/todo"

sb = SkillBuilder()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def read_agent_text(resp) -> str:
    """Read Bedrock Agents eventstream and return concatenated text."""
    parts = []
    for event in resp.get("completion", []):
        chunk = event.get("chunk")
        if chunk and chunk.get("bytes"):
            parts.append(chunk["bytes"].decode("utf-8", errors="replace"))
        if "error" in event:
            raise RuntimeError(f"Bedrock stream error: {event['error']}")
    return "".join(parts).strip()

def extract_json_object(text: str) -> str:
    """Extract the first JSON object from text, removing comments if present."""
    if not text:
        raise ValueError("Empty agent output")

    # Remove // and /* */ comments (models sometimes add these)
    text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No JSON object found. head={text[:200]}")
    return text[start:end+1].strip()

def extract_reminder_fields(query: str, session_id: str | None = None) -> dict:
    # Keep sessionId stable per user if you want multi-turn memory; otherwise random is fine
    session_id = session_id or str(uuid.uuid4())

    # Strongly constrain output to JSON
    prompt = f"""
Extract reminder details from the text.
Return ONLY valid JSON (no markdown, no extra text).
Timezone: America/Vancouver.

Text: {query}

JSON schema:
{{
  "task": string,
  "date": string|null,          // e.g. "2026-02-02"
  "time": string|null,          // e.g. "15:00"
  "confidence": number          // 0..1
}}
"""

    resp = bedrock.invoke_agent(
        agentId=AGENT_ID,
        agentAliasId=AGENT_ALIAS_ID,
        sessionId=session_id,
        inputText=prompt,
        enableTrace=False,
    )

    return resp



def call_vercel(action, data):
    body = json.dumps({
        "action": action,
        "data": data
    }).encode("utf-8")

    req = urllib.request.Request(
        VERCEL_API_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    urllib.request.urlopen(req)

class LaunchRequestHandler(AbstractRequestHandler):
    """Handler for Skill Launch."""
    def can_handle(self, handler_input):
        # type: (HandlerInput) -> bool
        return is_request_type("LaunchRequest")(handler_input)

    def handle(self, handler_input):
        # type: (HandlerInput) -> Response
        speech_text = "Welcome to the Alexa Skills Kit, you can say hello!"

        handler_input.response_builder.speak(speech_text).set_should_end_session(
            False)
        
        return handler_input.response_builder.response

class AddTodoIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("AddTodoIntent")(handler_input)

    def handle(self, handler_input):
        item = handler_input.request_envelope.request.intent.slots["todoItem"].value

        speech_text = f"Added {item} to your list."
        handler_input.response_builder.speak(speech_text).set_card(
            SimpleCard("To Do", speech_text)
        )
        logger.info("add to do")
        # call_vercel("add", {"item": item})

        return handler_input.response_builder.response


class RemoveTodoIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("RemoveTodoIntent")(handler_input)

    def handle(self, handler_input):
        item = handler_input.request_envelope.request.intent.slots["todoItem"].value

        speech_text = f"Removed {item} from your list."
        logger.info("remove to do")

        handler_input.response_builder.speak(speech_text)
        # call_vercel("remove", {"item": item})

        return handler_input.response_builder.response


class CompleteTodoIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("CompleteTodoIntent")(handler_input)

    def handle(self, handler_input):
        item = handler_input.request_envelope.request.intent.slots["todoItem"].value

        speech_text = f"Marked {item} as completed."
        logger.info("complete to do")

        handler_input.response_builder.speak(speech_text)
        # call_vercel("complete", {"item": item})

        return handler_input.response_builder.response

class YoutubeIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("YoutubeIntent")(handler_input)

    def handle(self, handler_input):
        
        speech_text = f"Playing Youtube on EchoGlass."
        logger.info("playing utube")

        handler_input.response_builder.speak(speech_text)
        # call_vercel("complete", {"item": item})

        return handler_input.response_builder.response

class PhotoTryOutIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("PhotoTryOutIntent")(handler_input)

    def handle(self, handler_input):
        
        speech_text = f"Let's do a photo try out."
        logger.info("photo try out")

        handler_input.response_builder.speak(speech_text)
        # call_vercel("complete", {"item": item})

        return handler_input.response_builder.response

class VideoTryOutIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("VideoTryOutIntent")(handler_input)

    def handle(self, handler_input):
        
        speech_text = f"Let's do a video try out."
        logger.info("vd try out")

        handler_input.response_builder.speak(speech_text)
        # call_vercel("complete", {"item": item})

        return handler_input.response_builder.response



class ReminderIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("ReminderIntent")(handler_input)

    def handle(self, handler_input):
        task = handler_input.request_envelope.request.intent.slots["task"].value

        speech_text = f"Reminder set for {task}."
        logger.info("reminder to do")
        response = extract_reminder_fields(task, session_id=str(uuid.uuid4()))
        text = read_agent_text(response)
        logger.info("agent raw len=%s head=%s", len(text), text[:250])
        json_str = extract_json_object(text)
        logger.info("look here %s", json_str)
        

        handler_input.response_builder.speak(speech_text)
        # call_vercel("reminder", {"task": task, "time": time})

        return handler_input.response_builder.response

class TestingIntentHandler(AbstractRequestHandler):
    """Handler for Hello World Intent."""
    def can_handle(self, handler_input):
        # type: (HandlerInput) -> bool
        return is_intent_name("TestingIntent")(handler_input)

    def handle(self, handler_input):
        # type: (HandlerInput) -> Response
        speech_text = "Hello Ketan, how are you?"

        handler_input.response_builder.speak(speech_text).set_card(
            SimpleCard("Hello World Coke", speech_text)).set_should_end_session(
            False)
        return handler_input.response_builder.response



class HelpIntentHandler(AbstractRequestHandler):
    """Handler for Help Intent."""
    def can_handle(self, handler_input):
        # type: (HandlerInput) -> bool
        return is_intent_name("AMAZON.HelpIntent")(handler_input)

    def handle(self, handler_input):
        # type: (HandlerInput) -> Response
        speech_text = "You can say hello to me!"

        handler_input.response_builder.speak(speech_text).ask(
            speech_text).set_card(SimpleCard(
                "Hello World", speech_text))
        return handler_input.response_builder.response


class CancelOrStopIntentHandler(AbstractRequestHandler):
    """Single handler for Cancel and Stop Intent."""
    def can_handle(self, handler_input):
        # type: (HandlerInput) -> bool
        return (is_intent_name("AMAZON.CancelIntent")(handler_input) or
                is_intent_name("AMAZON.StopIntent")(handler_input))

    def handle(self, handler_input):
        # type: (HandlerInput) -> Response
        speech_text = "Goodbye!"

        handler_input.response_builder.speak(speech_text).set_card(
            SimpleCard("Hello World", speech_text))
        return handler_input.response_builder.response


class FallbackIntentHandler(AbstractRequestHandler):
    """
    This handler will not be triggered except in supported locales,
    so it is safe to deploy on any locale.
    """
    def can_handle(self, handler_input):
        # type: (HandlerInput) -> bool
        return is_intent_name("AMAZON.FallbackIntent")(handler_input)

    def handle(self, handler_input):
        # type: (HandlerInput) -> Response
        speech_text = (
            "The Hello World skill can't help you with that.  "
            "You can say hello!!")
        reprompt = "You can say hello!!"

        req = handler_input.request_envelope.request

        intent_name = None
        slots_dict = {}

        if getattr(req, "object_type", "") == "IntentRequest":
            intent = getattr(req, "intent", None)
            intent_name = getattr(intent, "name", None)

            slots = getattr(intent, "slots", None)
            if slots:
                slots_dict = {k: getattr(v, "value", None) for k, v in slots.items()}
            else:
                slots_dict = {}

        logger.info("request.type=%s intent=%s slots=%s",
                    getattr(req, "object_type", None),
                    intent_name,
                    slots_dict)
        handler_input.response_builder.speak(speech_text).ask(reprompt)
        return handler_input.response_builder.response


class SessionEndedRequestHandler(AbstractRequestHandler):
    """Handler for Session End."""
    def can_handle(self, handler_input):
        # type: (HandlerInput) -> bool
        return is_request_type("SessionEndedRequest")(handler_input)

    def handle(self, handler_input):
        # type: (HandlerInput) -> Response
        return handler_input.response_builder.response


class CatchAllExceptionHandler(AbstractExceptionHandler):
    """Catch all exception handler, log exception and
    respond with custom message.
    """
    def can_handle(self, handler_input, exception):
        # type: (HandlerInput, Exception) -> bool
        return True

    def handle(self, handler_input, exception):
        # type: (HandlerInput, Exception) -> Response
        logger.error(exception, exc_info=True)

        speech = "Sorry, there was some problem. Please try again!!"
        handler_input.response_builder.speak(speech).ask(speech)

        return handler_input.response_builder.response


sb.add_request_handler(LaunchRequestHandler())
sb.add_request_handler(TestingIntentHandler())
sb.add_request_handler(HelpIntentHandler())
sb.add_request_handler(CancelOrStopIntentHandler())
sb.add_request_handler(FallbackIntentHandler())
sb.add_request_handler(SessionEndedRequestHandler())

sb.add_request_handler(AddTodoIntentHandler())
sb.add_request_handler(RemoveTodoIntentHandler())
sb.add_request_handler(CompleteTodoIntentHandler())
sb.add_request_handler(ReminderIntentHandler())
sb.add_request_handler(YoutubeIntentHandler())
sb.add_request_handler(PhotoTryOutIntentHandler())
sb.add_request_handler(VideoTryOutIntentHandler())



sb.add_request_handler(SessionEndedRequestHandler())



sb.add_exception_handler(CatchAllExceptionHandler())

lambda_handler = sb.lambda_handler()