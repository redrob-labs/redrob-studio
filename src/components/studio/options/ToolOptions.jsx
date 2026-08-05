import CompressImageOptions from './CompressImageOptions';
import ConvertAudioOptions from './ConvertAudioOptions';
import ConvertImageOptions from './ConvertImageOptions';
import CreateModelOptions from './CreateModelOptions';
import VisionOptions from './VisionOptions';
import MusicOptions from './MusicOptions';
import SpeakOptions from './SpeakOptions';
import TranscribeOptions from './TranscribeOptions';
import UpscaleOptions from './UpscaleOptions';
import VoiceCloneOptions from './VoiceCloneOptions';
import VoiceDesignOptions from './VoiceDesignOptions';

export default function ToolOptions(props) {
  return (
    <>
      <CreateModelOptions {...props} />
      <UpscaleOptions {...props} />
      <ConvertAudioOptions {...props} />
      <ConvertImageOptions {...props} />
      <CompressImageOptions {...props} />
      <TranscribeOptions {...props} />
      <VisionOptions {...props} />
      <MusicOptions {...props} />
      <SpeakOptions {...props} />
      <VoiceCloneOptions {...props} />
      <VoiceDesignOptions {...props} />
    </>
  );
}
