import json
from channels.generic.websocket import AsyncWebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(
            'test',
            self.channel_name
        )
        await self.accept()
        print('Connected')

    async def disconnect(self, code):
        await self.channel_layer.group_discard(
            'test',
            self.channel_name
        )

        print('Disconnected')

    async def receive(self, text_data=None):
        receive_dict = json.loads(text_data)
        message = receive_dict['message']

        await self.channel_layer.group_send(
            'test',
            {
                'type': 'send.message',
                'message': message
            }
        )

    async def send_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message']
        }))
