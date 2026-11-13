import { Form, Input, Modal, Radio } from "antd";

import { Album, AlbumInput } from "../../types";

const STATUS_OPTIONS: { value: Album["status"]; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "wishlisted", label: "Wishlisted" },
];

const NEW_ALBUM: AlbumInput = { title: "", artist: "", status: "owned" };

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function validateCoverUrl(_: unknown, value?: string) {
  const url = value?.trim();
  if (url && !isHttpUrl(url)) {
    throw new Error("Enter a URL that starts with http:// or https://");
  }
}

interface AlbumFormModalProps {
  open: boolean;
  /** The album to edit. Leave undefined to add a new one. */
  album?: Album;
  onSubmit: (input: AlbumInput) => void;
  onCancel: () => void;
}

export function AlbumFormModal({
  open,
  album,
  onSubmit,
  onCancel,
}: AlbumFormModalProps) {
  const handleFinish = ({ title, artist, coverUrl, status }: AlbumInput) => {
    onSubmit({
      title: title.trim(),
      artist: artist.trim(),
      coverUrl: coverUrl?.trim() || undefined,
      status,
    });
  };

  return (
    <Modal
      open={open}
      title={album ? "Edit album" : "Add album"}
      okText={album ? "Save" : "Add"}
      okButtonProps={{ htmlType: "submit" }}
      onCancel={onCancel}
      // A stray click outside shouldn't throw away a half-filled form.
      mask={{ closable: false }}
      destroyOnHidden
      // Wrap the whole dialog so the OK button (and Enter) submits the form.
      modalRender={(dialog) => (
        <Form<AlbumInput>
          name="album"
          layout="vertical"
          requiredMark="optional"
          initialValues={album ?? NEW_ALBUM}
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
      <Form.Item
        name="coverUrl"
        label="Cover image URL"
        rules={[{ validator: validateCoverUrl }]}
      >
        <Input inputMode="url" placeholder="https://example.com/cover.jpg" />
      </Form.Item>
      <Form.Item name="status" label="Status" rules={[{ required: true }]}>
        <Radio.Group options={STATUS_OPTIONS} optionType="button" />
      </Form.Item>
    </Modal>
  );
}
