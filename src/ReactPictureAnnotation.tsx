import React, { MouseEventHandler } from "react";
import { IAnnotation } from "./Annotation";
import { IAnnotationState } from "./annotation/AnnotationState";
import { DefaultAnnotationState } from "./annotation/DefaultAnnotationState";
import DefaultInputSection from "./DefaultInputSection";
// import DeleteButton from "./DeleteButton";
import {
  defaultShapeStyle,
  IShape,
  IShapeBase,
  IShapeStyle,
  RectShape,
} from "./Shape";
import Transformer, { ITransformer } from "./Transformer";
import { toRadians } from "./utils/utils";

interface IReactPictureAnnotationProps {
  annotationData?: IAnnotation[];
  selectedId?: string | null;
  scrollSpeed: number;
  marginWithInput: number;
  onChange: (annotationData: IAnnotation[]) => void;
  onSelect: (id: string | null) => void;
  onFinish: (data: IAnnotation) => void;
  width: number;
  height: number;
  image: string;
  degrees?: number;
  annotationStyle: IShapeStyle;
  defaultAnnotationSize?: number[];
  inputElement: (
    value: string,
    onChange: (value: string) => void,
    onDelete: () => void
  ) => React.ReactElement;

  /*   zoomIn: number;
  zoomOut?: number;
  offset: {
    x: number;
    y: number;
  }; */
}

interface IStageState {
  scale: number;
  originX: number;
  originY: number;
}

const defaultState: IStageState = {
  scale: 1,
  originX: 0,
  originY: 0,
};

export default class ReactPictureAnnotation extends React.Component<IReactPictureAnnotationProps> {
  public static defaultProps = {
    marginWithInput: 10,
    scrollSpeed: 0.0005,
    annotationStyle: defaultShapeStyle,
    degrees: 0,
    inputElement: (
      value: string,
      onChange: (value: string) => void,
      onDelete: () => void
    ) => (
      <DefaultInputSection
        value={value}
        onChange={onChange}
        onDelete={onDelete}
      />
    ),
  };

  public state = {
    inputPosition: {
      left: 0,
      top: 0,
    },
    showInput: false,
    inputComment: "",
  };

  set selectedId(value: string | null) {
    const { onSelect } = this.props;
    this.selectedIdTrueValue = value;
    onSelect(value);
  }

  get selectedId() {
    return this.selectedIdTrueValue;
  }

  get annotationStyle() {
    return this.props.annotationStyle;
  }

  get defaultAnnotationSize() {
    return this.props.defaultAnnotationSize;
  }

  public shapes: IShape[] = [];
  public scaleState = defaultState;
  public currentTransformer: ITransformer;

  private currentAnnotationData: IAnnotation[] = [];
  private selectedIdTrueValue: string | null;
  private canvasRef = React.createRef<HTMLCanvasElement>();
  private canvas2D?: CanvasRenderingContext2D | null;
  private imageCanvasRef = React.createRef<HTMLCanvasElement>();
  private imageCanvas2D?: CanvasRenderingContext2D | null;
  private currentImageElement?: HTMLImageElement;
  private currentAnnotationState: IAnnotationState = new DefaultAnnotationState(
    this
  );

  public componentDidMount = () => {
    const currentCanvas = this.canvasRef.current;
    const currentImageCanvas = this.imageCanvasRef.current;
    if (currentCanvas && currentImageCanvas) {
      this.setCanvasDPI();

      this.canvas2D = currentCanvas.getContext("2d");
      this.imageCanvas2D = currentImageCanvas.getContext("2d");
      this.onImageChange();
    }

    this.syncAnnotationData();
    this.syncSelectedId();
  };

  public componentDidUpdate = (preProps: IReactPictureAnnotationProps) => {
    const { width, height, image, degrees } = this.props;
    if (preProps.width !== width || preProps.height !== height) {
      this.setCanvasDPI();
      this.onShapeChange();
      this.onImageChange();
    }
    if (preProps.image !== image) {
      this.cleanImage();
      if (this.currentImageElement) {
        this.currentImageElement.src = image;
      } else {
        this.onImageChange();
      }
    }
    if (preProps.degrees !== degrees) {
      this.onImageChange();
    }

    this.syncAnnotationData();
    this.syncSelectedId();
  };

  public calculateMousePosition = (positionX: number, positionY: number) => {
    const { originX, originY, scale } = this.scaleState;
    return {
      positionX: (positionX - originX) / scale,
      positionY: (positionY - originY) / scale,
    };
  };

  public calculateShapePosition = (shapeData: IShapeBase): IShapeBase => {
    const { originX, originY, scale } = this.scaleState;
    const { x, y, width, height } = shapeData;

    /*  const newX =
      x * Math.cos((angle * Math.PI) / 180) -
      y * Math.sin((angle * Math.PI) / 180);
    const newY =
      x * Math.sin((angle * Math.PI) / 180) +
      y * Math.cos((angle * Math.PI) / 180); */

    const newX = x * scale + originX;
    const newY = y * scale + originY;

    const xRotate = newX;
    const yRotate = newY;

    return {
      x: xRotate,
      y: yRotate,
      width: width * scale,
      height: height * scale,
      // rotateX: originX + (x * scale) / 2,
      // rotateY: originY + (y * scale) / 2,
    };
  };

  public render() {
    const { width, height, inputElement } = this.props;
    const { showInput, inputPosition, inputComment } = this.state;
    return (
      <div className="rp-stage">
        <canvas
          style={{ width, height }}
          className="rp-image"
          ref={this.imageCanvasRef}
          width={width * 2}
          height={height * 2}
        />
        <canvas
          className="rp-shapes"
          style={{ width, height }}
          ref={this.canvasRef}
          width={width * 2}
          height={height * 2}
          onMouseDown={this.onMouseDown}
          onMouseMove={this.onMouseMove}
          onMouseUp={this.onMouseUp}
          onMouseLeave={this.onMouseLeave}
          onWheel={this.onWheel}
        />
        {showInput && (
          <div className="rp-selected-input" style={inputPosition}>
            {inputElement(
              inputComment,
              this.onInputCommentChange,
              this.onDelete
            )}
          </div>
        )}
      </div>
    );
  }

  public setAnnotationState = (annotationState: IAnnotationState) => {
    this.currentAnnotationState = annotationState;
  };

  public onShapeChange = () => {
    if (this.canvas2D && this.canvasRef.current) {
      this.canvas2D.clearRect(
        0,
        0,
        this.canvasRef.current.width,
        this.canvasRef.current.height
      );

      let hasSelectedItem = false;

      for (const item of this.shapes) {
        const isSelected = item.getAnnotationData().id === this.selectedId;

        // const xImage = this.currentImageElement?.width ?? 0;
        // const yImage = this.currentImageElement?.height ?? 0;
        // const newOriginX = xImage + this.scaleState.originX;
        // const newOriginY = yImage + this.scaleState.originY;

        const { x, y, height } = item.paint(
          this.canvas2D,
          this.calculateShapePosition,
          isSelected,
          this.props.degrees ?? 0,
          {
            width: this.currentImageElement?.width ?? 0 * this.scaleState.scale,
            height:
              this.currentImageElement?.height ?? 0 * this.scaleState.scale,
          }
        );

        if (isSelected) {
          if (
            !this.currentTransformer ||
            this.currentTransformer.shapeId !== item.getAnnotationData().id
          ) {
            this.currentTransformer = new Transformer(
              item,
              this.scaleState.scale
            );
          }

          hasSelectedItem = true;

          this.currentTransformer.paint(
            this.canvas2D,
            this.calculateShapePosition,
            this.scaleState.scale
          );

          this.setState({
            showInput: true,
            inputPosition: {
              left: x,
              top: y + height + this.props.marginWithInput,
            },
            inputComment: item.getAnnotationData().comment || "",
          });
        }
      }

      if (!hasSelectedItem) {
        this.setState({
          showInput: false,
          inputComment: "",
        });
      }
    }

    this.currentAnnotationData = this.shapes.map((item) =>
      item.getAnnotationData()
    );
    const { onChange } = this.props;
    onChange(this.currentAnnotationData);
  };

  private syncAnnotationData = () => {
    const { annotationData } = this.props;
    if (annotationData) {
      const refreshShapesWithAnnotationData = () => {
        this.selectedId = null;
        this.shapes = annotationData.map(
          (eachAnnotationData) =>
            new RectShape(
              eachAnnotationData,
              this.onShapeChange,
              this.annotationStyle
            )
        );
        this.onShapeChange();
      };

      if (annotationData.length !== this.shapes.length) {
        refreshShapesWithAnnotationData();
      } else {
        for (const annotationDataItem of annotationData) {
          const targetShape = this.shapes.find(
            (item) => item.getAnnotationData().id === annotationDataItem.id
          );
          if (targetShape && targetShape.equal(annotationDataItem)) {
            continue;
          } else {
            refreshShapesWithAnnotationData();
            break;
          }
        }
      }
    }
  };

  private syncSelectedId = () => {
    const { selectedId } = this.props;

    if (selectedId && selectedId !== this.selectedId) {
      this.selectedId = selectedId;
      this.onShapeChange();
    }
  };

  private onDelete = () => {
    const deleteTarget = this.shapes.findIndex(
      (shape) => shape.getAnnotationData().id === this.selectedId
    );
    if (deleteTarget >= 0) {
      this.shapes.splice(deleteTarget, 1);
      this.onShapeChange();
    }
  };

  private setCanvasDPI = () => {
    const currentCanvas = this.canvasRef.current;
    const currentImageCanvas = this.imageCanvasRef.current;
    if (currentCanvas && currentImageCanvas) {
      const currentCanvas2D = currentCanvas.getContext("2d");
      const currentImageCanvas2D = currentImageCanvas.getContext("2d");
      if (currentCanvas2D && currentImageCanvas2D) {
        currentCanvas2D.scale(2, 2);
        currentImageCanvas2D.scale(2, 2);
      }
    }
  };

  private onInputCommentChange = (comment: string) => {
    const selectedShapeIndex = this.shapes.findIndex(
      (item) => item.getAnnotationData().id === this.selectedId
    );
    this.shapes[selectedShapeIndex].setComment(comment);
    this.setState({ inputComment: comment });
  };

  private cleanImage = () => {
    if (this.imageCanvas2D && this.imageCanvasRef.current) {
      this.imageCanvas2D.clearRect(
        0,
        0,
        this.imageCanvasRef.current.width,
        this.imageCanvasRef.current.height
      );
    }
  };

  private onImageChange = () => {
    this.cleanImage();
    if (this.imageCanvas2D && this.imageCanvasRef.current) {
      if (this.currentImageElement) {
        const { scale, originX, originY } = this.scaleState;
        if (this.props.degrees) {
          // To rotate the image
          const { width: canvasWidth, height: canvasHeight } = this.props;
          // const scaleX = this.currentImageElement.width;
          // const scaleY = canvasHeight / this.currentImageElement.height;
          const x = this.currentImageElement.width * 0.5;
          const y = this.currentImageElement.height * 0.5;
          const newOriginX = x + originX;
          const newOriginY = y + originY;
          const radians = toRadians(this.props.degrees);
          this.imageCanvas2D.save(); // saves current transformation matrix (state)
          this.imageCanvas2D.translate(+canvasWidth / 2, +canvasHeight / 2);
          this.imageCanvas2D.scale(scale, scale);
          this.imageCanvas2D.rotate(radians); // rotates the image around origin point by used translations
          this.imageCanvas2D.translate(-newOriginX, -newOriginY);

          this.imageCanvas2D.drawImage(
            this.currentImageElement,
            originX,
            originY
          ); // draws the image in the position (imageX, imageY)
          this.imageCanvas2D.restore(); //
          this.onShapeChange();
        } else {
          // const { originX, originY } = this.scaleState;
          this.imageCanvas2D.drawImage(
            this.currentImageElement,
            originX,
            originY,
            this.currentImageElement.width * scale,
            this.currentImageElement.height * scale
          );
        }
      } else {
        const nextImageNode = document.createElement("img");
        nextImageNode.addEventListener("load", () => {
          this.currentImageElement = nextImageNode;
          const { width, height } = nextImageNode;
          const imageNodeRatio = height / width;
          const { width: canvasWidth, height: canvasHeight } = this.props;
          const canvasNodeRatio = canvasHeight / canvasWidth;
          if (!isNaN(imageNodeRatio) && !isNaN(canvasNodeRatio)) {
            if (imageNodeRatio < canvasNodeRatio) {
              const scale = canvasWidth / width;
              this.scaleState = {
                originX: 0,
                originY: (canvasHeight - scale * height) / 2,
                scale,
              };
              /*  this.scaleState = {
                originX: (canvasWidth - scale * width) / 2,
                originY: 0,
                scale,
              }; */
            } else {
              const scale = canvasHeight / height;
              this.scaleState = {
                originX: (canvasWidth - scale * width) / 2,
                originY: 0,
                scale,
              };
            }
          }
          this.onImageChange();
          this.onShapeChange();
        });
        nextImageNode.alt = "";
        nextImageNode.src = this.props.image;
      }
    }
  };

  /*   private rotateLeft = () => {
    this.drawImage(-Math.PI / 2);
  };

  private rotateRight = () => {
    this.drawImage(Math.PI / 2);
  }; */

  private onMouseDown: MouseEventHandler<HTMLCanvasElement> = (event) => {
    const { offsetX, offsetY } = event.nativeEvent;
    const { positionX, positionY } = this.calculateMousePosition(
      offsetX,
      offsetY
    );
    this.currentAnnotationState.onMouseDown(positionX, positionY);
  };

  private onMouseMove: MouseEventHandler<HTMLCanvasElement> = (event) => {
    const { offsetX, offsetY } = event.nativeEvent;
    const { positionX, positionY } = this.calculateMousePosition(
      offsetX,
      offsetY
    );
    this.currentAnnotationState.onMouseMove(positionX, positionY);
  };

  private onMouseUp: MouseEventHandler<HTMLCanvasElement> = () => {
    this.currentAnnotationState.onMouseUp(this.props.onFinish);
  };

  private onMouseLeave: MouseEventHandler<HTMLCanvasElement> = () => {
    this.currentAnnotationState.onMouseLeave();
  };

  private onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    // https://stackoverflow.com/a/31133823/9071503
    const { clientHeight, scrollTop, scrollHeight } = event.currentTarget;
    if (clientHeight + scrollTop + event.deltaY > scrollHeight) {
      // event.preventDefault();
      event.currentTarget.scrollTop = scrollHeight;
    } else if (scrollTop + event.deltaY < 0) {
      // event.preventDefault();
      event.currentTarget.scrollTop = 0;
    }

    const { scale: preScale } = this.scaleState;
    this.scaleState.scale += event.deltaY * this.props.scrollSpeed;
    if (this.scaleState.scale > 10) {
      this.scaleState.scale = 10;
    }
    if (this.scaleState.scale < 0.1) {
      this.scaleState.scale = 0.1;
    }

    const { originX, originY, scale } = this.scaleState;
    const { offsetX, offsetY } = event.nativeEvent;
    this.scaleState.originX =
      offsetX - ((offsetX - originX) / preScale) * scale;
    this.scaleState.originY =
      offsetY - ((offsetY - originY) / preScale) * scale;

    this.setState({ imageScale: this.scaleState });

    requestAnimationFrame(() => {
      this.onShapeChange();
      this.onImageChange();
    });
  };
}
