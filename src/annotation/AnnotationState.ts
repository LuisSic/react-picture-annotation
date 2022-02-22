import { IAnnotation } from "../Annotation";

export type onFinishFunction = (markId: IAnnotation) => void;
export interface IAnnotationState {
  onMouseDown: (positionX: number, positionY: number) => void;
  onMouseMove: (positionX: number, positionY: number) => void;
  onMouseLeave: () => void;
  onMouseUp: (onFinish?: onFinishFunction) => void;
}
