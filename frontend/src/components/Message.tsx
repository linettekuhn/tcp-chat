import styles from "./Message.module.css";

type Props = {
  msg: string;
};

export default function Message({ msg }: Props) {
  let sender, message;

  if (msg.startsWith("(SERVER)")) {
    // handle server messages
    sender = null;
    message = msg.replace("(SERVER) ", "");
  } else {
    // break up the string (to extract sender and date)
    const msgComponents = msg.split(":");
    // grab first element
    sender = msgComponents.shift();
    // join the rest of the message
    message = msgComponents.join(":");
  }

  return (
    <div className={sender ? styles.message : styles.serverMessage}>
      {sender ? <p className={styles.displayName}>{sender}</p> : null}
      <p className={styles.messageText}>{message}</p>
    </div>
  );
}
