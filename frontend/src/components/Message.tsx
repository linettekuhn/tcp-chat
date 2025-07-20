type Props = {
  msg: string;
};

export default function Message({ msg }: Props) {
  return (
    <div className="message">
      <p>{msg}</p>
    </div>
  );
}
