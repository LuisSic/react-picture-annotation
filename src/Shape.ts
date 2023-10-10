import { IAnnotation } from "./Annotation";
import { toRadians } from "./utils/utils";

export const defaultShapeStyle: IShapeStyle = {
  padding: 5,
  lineWidth: 2,
  shadowBlur: 10,
  fontSize: 12,
  fontColor: "#212529",
  fontBackground: "#f8f9fa",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  shapeBackground: "hsla(210, 16%, 93%, 0.2)",
  shapeStrokeStyle: "#f8f9fa",
  shapeShadowStyle: "hsla(210, 9%, 31%, 0.35)",
  transformerBackground: "#5c7cfa",
  transformerSize: 10,
  initShapeBackground: "rgba(135, 149, 150, 0.3)",
};

export interface IShapeStyle {
  padding: number;
  lineWidth: number;
  shadowBlur: number;
  fontSize: number;
  fontColor: string;
  fontBackground: string;
  fontFamily: string;
  shapeBackground: string;
  shapeStrokeStyle: string;
  shapeShadowStyle: string;
  transformerBackground: string;
  transformerSize: number;
  initShapeBackground: string;
}

export interface IShapeBase {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IShapeAdjustBase {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface IShapeData extends IShapeBase {
  type: string;
}

export interface IRectShapeData extends IShapeData {
  type: "RECT";
}

export interface IRotation {
  positionX?: number;
  positionY?: number;
  degrees: number;
}

export interface IShape {
  shapeStyle: IShapeStyle;
  onDragStart: (positionX: number, positionY: number) => void;
  onDrag: (positionX: number, positionY: number) => void;
  checkBoundary: (positionX: number, positionY: number) => boolean;
  paint: (
    canvas2D: CanvasRenderingContext2D,
    calculateTruePosition: (shapeData: IShapeBase) => IShapeBase,
    selected: boolean,
    degrees: number,
    image: {
      width: number;
      height: number;
    }
  ) => IShapeBase;
  getAnnotationData: () => IAnnotation;
  adjustMark: (adjustBase: IShapeAdjustBase) => void;
  setComment: (comment: string) => void;
  equal: (data: IAnnotation) => boolean;
}

export class RectShape implements IShape {
  private readonly annotationData: IAnnotation<IShapeData>;

  private readonly onChangeCallBack: () => void;

  private dragStartOffset: { offsetX: number; offsetY: number };

  public readonly shapeStyle: IShapeStyle;

  constructor(
    data: IAnnotation<IShapeData>,
    onChange: () => void,
    shapeStyle: IShapeStyle = defaultShapeStyle
  ) {
    this.annotationData = data;
    this.onChangeCallBack = onChange;
    this.shapeStyle = shapeStyle;
  }

  public onDragStart = (positionX: number, positionY: number) => {
    const { x, y } = this.annotationData.mark;
    this.dragStartOffset = {
      offsetX: positionX - x,
      offsetY: positionY - y,
    };
  };

  public onDrag = (positionX: number, positionY: number) => {
    this.annotationData.mark.x = positionX - this.dragStartOffset.offsetX;
    this.annotationData.mark.y = positionY - this.dragStartOffset.offsetY;
    this.onChangeCallBack();
  };

  public checkBoundary = (positionX: number, positionY: number) => {
    const {
      mark: { x, y, width, height },
    } = this.annotationData;

    return (
      ((positionX > x && positionX < x + width) ||
        (positionX < x && positionX > x + width)) &&
      ((positionY > y && positionY < y + height) ||
        (positionY < y && positionY > y + height))
    );
  };

  public paint = (
    canvas2D: CanvasRenderingContext2D,
    calculateTruePosition: (shapeData: IShapeBase) => IShapeBase,
    selected: boolean,
    degrees: number,
    _image: {
      width: number;
      height: number;
    }
  ) => {
    const { x, y, width, height } = calculateTruePosition(
      this.annotationData.mark
    );
    canvas2D.save();

    const {
      lineWidth,
      shadowBlur,
      shapeBackground,
      shapeStrokeStyle,
      shapeShadowStyle,
      initShapeBackground,
    } = this.shapeStyle;

    canvas2D.shadowBlur = shadowBlur;
    canvas2D.shadowColor = shapeShadowStyle;
    canvas2D.strokeStyle = shapeStrokeStyle;
    canvas2D.lineWidth = lineWidth;
    const newX = x;
    const newY = y;
    if (degrees) {
      // newY = image.height - (height + y);
      // newX = image.width - (width + x);
      const radians = toRadians(degrees);
      // const newX = height + y - image.height;
      // const newY = width + x - image.width;
      const originX = x + width / 2;
      const originY = y + height / 2;
      // canvas2D.save(); // saves current transformation matrix (state)
      canvas2D.translate(canvas2D.canvas.width / 2, canvas2D.canvas.height / 2);
      canvas2D.rotate(radians);
      canvas2D.translate(-originX, -originY);
      /* const centerX = image.width;
      const centerY = image.height; */
      /*  const newX =
        centerX +
        (x - centerX) * Math.cos(radians) -
        (y - centerY) * Math.sin(radians);

      const newY =
        centerY +
        (x - centerX) * Math.sin(radians) +
        (y - centerY) * Math.cos(radians); */
      // console.log('🚀 ~ file: Shape.ts:178 ~ RectShape ~ newY:', newY);
      // const newX = height + y - image.height;
      // const newY = width + x - image.width;

      canvas2D.strokeRect(newX, newY, width, height);
    } else {
      canvas2D.strokeRect(newX, newY, width, height);
    }

    // canvas2D.restore();

    if (selected) {
      canvas2D.fillStyle = shapeBackground;
      canvas2D.fillRect(newX, newY, width, height);
    } else {
      canvas2D.fillStyle = initShapeBackground;
      canvas2D.fillRect(newX, newY, width, height);
      /*  const { comment } = this.annotationData;
      if (comment) {
        canvas2D.font = `${fontSize}px ${fontFamily}`;
        const metrics = canvas2D.measureText(comment);
        canvas2D.save();
        canvas2D.fillStyle = shapeBackground;
        canvas2D.fillRect(
          x,
          y,
          metrics.width + padding * 2,
          fontSize + padding * 2
        );
        canvas2D.textBaseline = 'top';
        canvas2D.fillStyle = fontColor;
        canvas2D.fillText(comment, x + padding, y + padding);
      } else {
      } */
    }

    canvas2D.restore();

    return { x, y, width, height };
  };

  public adjustMark = ({
    x = this.annotationData.mark.x,
    y = this.annotationData.mark.y,
    width = this.annotationData.mark.width,
    height = this.annotationData.mark.height,
  }: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => {
    this.annotationData.mark.x = x;
    this.annotationData.mark.y = y;
    this.annotationData.mark.width = width;
    this.annotationData.mark.height = height;
    this.onChangeCallBack();
  };

  public getAnnotationData = () => {
    return this.annotationData;
  };

  public setComment = (comment: string) => {
    this.annotationData.comment = comment;
  };

  public equal = (data: IAnnotation) => {
    return (
      data.id === this.annotationData.id &&
      data.comment === this.annotationData.comment &&
      data.mark.x === this.annotationData.mark.x &&
      data.mark.y === this.annotationData.mark.y &&
      data.mark.width === this.annotationData.mark.width &&
      data.mark.height === this.annotationData.mark.height
    );
  };
}
