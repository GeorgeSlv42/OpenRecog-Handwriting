import { NativeModule, requireNativeModule } from 'expo';

declare class IOSappModule extends NativeModule<{}> {}

export default requireNativeModule<IOSappModule>('IOSapp');
