import { registerWebModule, NativeModule } from 'expo';

class IOSappModule extends NativeModule<{}> {}

export default registerWebModule(IOSappModule, 'IOSappModule');
