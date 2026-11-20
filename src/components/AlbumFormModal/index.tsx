import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
} from "antd";

import { findDuplicate } from "../../albumFiles";
import { FORMAT_LABELS, FORMAT_OPTIONS } from "../../albumFormats";
import { toYear } from "../../albumYears";
import { Album, AlbumFormat, AlbumInput } from "../../types";
import { AlbumCoverField } from "../AlbumCoverField";

const STATUS_OPTIONS: { value: Album["status"]; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "wishlisted", label: "Wishlisted" },
];

const NEW_ALBUM: AlbumInput = { title: "", artist: "", status: "owned" };

// Up to next year, for albums that are on the way.
async function validateYear(_: unknown, value?: string | number) {
  const text = value?.toString().trim() ?? "";
  const year = Number(text);
  if (
    text &&
    !(
      /^\d{4}$/.test(text) &&
      year >= 1000 &&
      year <= new Date().getFullYear() + 1
    )
  ) {
    throw new Error("Enter a year, like 1959");
  }
}

interface AlbumFormModalProps {
  open: boolean;
  /** The album to edit. Leave undefined to add a new one. */
  album?: Album;
  /** The collection, to warn before adding an album that's already in it. */
  albums: Album[];
  /** The format a new album starts with. */
  defaultFormat?: AlbumFormat;
  onSubmit: (input: AlbumInput) => void;
  onCancel: () => void;
}

interface DuplicateCheckProps {
  albums: Album[];
  album?: Album;
}

/** The album already in the collection that the form, as filled in, repeats. */
function useDuplicate({ albums, album }: DuplicateCheckProps) {
  const form = Form.useFormInstance<AlbumInput>();
  const title = Form.useWatch("title", form) ?? "";
  const artist = Form.useWatch("artist", form) ?? "";
  const format = Form.useWatch("format", form);
  return findDuplicate(albums, { title, artist, format }, album?.id);
}

function DuplicateWarning(props: DuplicateCheckProps) {
  const duplicate = useDuplicate(props);
  if (!duplicate) {
    return null;
  }

  const format = duplicate.format
    ? ` (${FORMAT_LABELS[duplicate.format]})`
    : "";
  const place =
    duplicate.status === "owned" ? "in your collection" : "on your wishlist";
  return (
    <Alert
      type="warning"
      showIcon
      title={`"${duplicate.title}" by ${duplicate.artist}${format} is already ${place}.`}
    />
  );
}

/** Asks to add or save "anyway" while the form repeats an album. */
function SubmitButton(props: DuplicateCheckProps) {
  const duplicate = useDuplicate(props);
  const action = props.album ? "Save" : "Add";
  return (
    <Button type="primary" htmlType="submit">
      {duplicate ? `${action} anyway` : action}
    </Button>
  );
}

export function AlbumFormModal({
  open,
  album,
  albums,
  defaultFormat,
  onSubmit,
  onCancel,
}: AlbumFormModalProps) {
  const handleFinish = ({
    title,
    artist,
    year,
    coverUrl,
    format,
    status,
    notes,
  }: AlbumInput) => {
    onSubmit({
      title: title.trim(),
      artist: artist.trim(),
      // Typed in as text, so made a number here.
      year: toYear(year),
      coverUrl: coverUrl?.trim() || undefined,
      format,
      status,
      notes: notes?.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      title={album ? "Edit album" : "Add album"}
      onCancel={onCancel}
      // A stray click outside shouldn't throw away a half-filled form.
      mask={{ closable: false }}
      destroyOnHidden
      footer={(_, { CancelBtn }) => (
        <>
          <CancelBtn />
          <SubmitButton albums={albums} album={album} />
        </>
      )}
      // Wrap the whole dialog so the submit button (and Enter) submits the
      // form, and the footer can see what's been filled in.
      modalRender={(dialog) => (
        <Form<AlbumInput>
          name="album"
          layout="vertical"
          requiredMark="optional"
          initialValues={album ?? { ...NEW_ALBUM, format: defaultFormat }}
          onFinish={handleFinish}
        >
          {dialog}
        </Form>
      )}
    >
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, whitespace: true, message: "Enter a title" }]}
      >
        <Input autoFocus />
      </Form.Item>
      <Form.Item
        name="artist"
        label="Artist"
        rules={[
          { required: true, whitespace: true, message: "Enter an artist" },
        ]}
      >
        <Input />
      </Form.Item>
      <AlbumCoverField />
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="year"
            label="Year"
            rules={[{ validator: validateYear }]}
          >
            <Input inputMode="numeric" maxLength={4} autoComplete="off" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="format" label="Format">
            <Select
              options={FORMAT_OPTIONS}
              placeholder="Choose a format"
              allowClear
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="status" label="Status" rules={[{ required: true }]}>
        <Radio.Group options={STATUS_OPTIONS} optionType="button" />
      </Form.Item>
      <Form.Item name="notes" label="Notes">
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder="The pressing, its condition, where you got it…"
        />
      </Form.Item>
      <DuplicateWarning albums={albums} album={album} />
    </Modal>
  );
}
